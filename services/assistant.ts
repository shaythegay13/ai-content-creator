import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db/client';
import type {
  AIMessageInput,
  AIProvider,
  ToolDefinition,
} from '../providers/contracts';
import * as s from '../db/schema';
import { savePost, saveVariant, scheduleVariant, attachMedia } from './content';
import { generate, retrieveContext } from './ai';
import { reviewOne } from './intelligence';
import { dayKey } from './editorial';
import { initializeVariants } from './platform-generation';
import { saveIdeaWithKnowledge, savePostWithKnowledge } from './content-brain';
import { boundedHistory, compactData, estimateTokens } from '../lib/ai-budget';
const str = { type: 'string' };
const specs: Record<string, Record<string, unknown>> = {
  createIdea: { title: str, rawNote: str },
  updateIdea: { id: str, title: str, rawNote: str },
  createPost: { title: str, coreIdea: str },
  updatePost: { id: str, title: str, coreIdea: str },
  createPlatformVariant: {
    postId: str,
    platform: { type: 'string', enum: ['x', 'linkedin'] },
    body: str,
  },
  schedulePost: {
    variantId: str,
    localTime: {
      type: 'string',
      description: 'YYYY-MM-DDTHH:mm in the requested timezone',
    },
    timezone: str,
  },
  attachMedia: { postId: str, mediaIds: { type: 'array', items: str } },
  searchPosts: { query: str },
  searchIdeas: { query: str },
  searchMedia: { query: str },
  searchIntelligence: { query: str },
  getTodaysIntelligence: {},
  searchTrends: { query: str },
  inspectPostPerformance: {},
  getDailyEditorialReview: {},
  reviewPostAgainstIntelligence: { variantId: str },
  createIdeaFromIntelligence: { intelligenceId: str },
};
export const assistantTools: ToolDefinition[] = Object.entries(specs).map(
  ([name, properties]) => ({
    type: 'function',
    function: {
      name,
      description: `${name}. Write actions require explicit user approval. Never publishes.`,
      parameters: {
        type: 'object',
        properties,
        required: Object.keys(properties),
        additionalProperties: false,
      },
    },
  }),
);
export const writeTools = new Set([
  'createIdea',
  'updateIdea',
  'createPost',
  'updatePost',
  'createPlatformVariant',
  'schedulePost',
  'attachMedia',
  'createIdeaFromIntelligence',
]);
export async function executeTool(
  db: Database,
  userId: string,
  provider: AIProvider,
  name: string,
  args: Record<string, unknown>,
) {
  const get = (key: string) => z.string().parse(args[key]);
  const savePost = (target: Database, owner: string, input: unknown) =>
    savePostWithKnowledge(target, owner, input, provider);
  const saveIdea = (target: Database, owner: string, input: unknown) =>
    saveIdeaWithKnowledge(target, owner, input, provider);
  switch (name) {
    case 'createIdea':
      return saveIdea(db, userId, args);
    case 'updateIdea': {
      const [old] = await db
        .select()
        .from(s.contentIdeas)
        .where(eq(s.contentIdeas.id, z.uuid().parse(args.id)));
      if (!old) throw new Error('Idea not found');
      const media = await db
        .select()
        .from(s.ideaMediaRelations)
        .where(eq(s.ideaMediaRelations.ideaId, old.id));
      return saveIdea(db, userId, {
        ...old,
        ...args,
        mediaIds: media.map((m) => m.mediaId),
      });
    }
    case 'createPost': {
      const post = await savePost(db, userId, args);
      await initializeVariants(db, provider, post.id);
      return post;
    }
    case 'updatePost': {
      const [old] = await db
        .select()
        .from(s.contentPosts)
        .where(eq(s.contentPosts.id, z.uuid().parse(args.id)));
      if (!old) throw new Error('Post not found');
      return savePost(db, userId, { ...old, ...args });
    }
    case 'createPlatformVariant':
      return saveVariant(db, args);
    case 'schedulePost':
      return scheduleVariant(db, args);
    case 'attachMedia':
      return attachMedia(
        db,
        z.uuid().parse(args.postId),
        z.array(z.uuid()).parse(args.mediaIds),
      );
    case 'searchPosts':
      return db
        .select()
        .from(s.contentPosts)
        .where(
          or(
            ilike(s.contentPosts.title, `%${get('query')}%`),
            ilike(s.contentPosts.coreIdea, `%${get('query')}%`),
          ),
        )
        .limit(10);
    case 'searchIdeas':
      return db
        .select()
        .from(s.contentIdeas)
        .where(ilike(s.contentIdeas.title, `%${get('query')}%`))
        .limit(10);
    case 'searchMedia':
      return db
        .select()
        .from(s.mediaAssets)
        .where(
          or(
            ilike(s.mediaAssets.filename, `%${get('query')}%`),
            ilike(s.mediaAssets.description, `%${get('query')}%`),
          ),
        )
        .limit(10);
    case 'searchIntelligence':
      return db
        .select()
        .from(s.intelligenceItems)
        .where(
          or(
            ilike(s.intelligenceItems.title, `%${get('query')}%`),
            ilike(s.intelligenceItems.summary, `%${get('query')}%`),
          ),
        )
        .limit(10);
    case 'searchTrends':
      return db
        .select()
        .from(s.trendItems)
        .where(ilike(s.trendItems.title, `%${get('query')}%`))
        .limit(10);
    case 'getTodaysIntelligence': {
      const rows = await db
        .select()
        .from(s.intelligenceItems)
        .orderBy(desc(s.intelligenceItems.createdAt))
        .limit(100);
      return rows.filter(
        (i) =>
          dayKey(
            i.createdAt,
            process.env.APP_TIMEZONE || 'America/New_York',
          ) ===
          dayKey(new Date(), process.env.APP_TIMEZONE || 'America/New_York'),
      );
    }
    case 'inspectPostPerformance':
      return db.select().from(s.postMetricSnapshots).limit(10);
    case 'getDailyEditorialReview':
      return db
        .select()
        .from(s.dailyEditorialReviews)
        .orderBy(desc(s.dailyEditorialReviews.createdAt))
        .limit(7);
    case 'reviewPostAgainstIntelligence': {
      const [v] = await db
        .select()
        .from(s.contentPostVariants)
        .where(eq(s.contentPostVariants.id, z.uuid().parse(args.variantId)));
      if (!v) throw new Error('Variant not found');
      return reviewOne(db, provider, v);
    }
    case 'createIdeaFromIntelligence': {
      const [item] = await db
        .select()
        .from(s.intelligenceItems)
        .where(eq(s.intelligenceItems.id, z.uuid().parse(args.intelligenceId)));
      if (!item) throw new Error('Intelligence not found');
      return saveIdea(db, userId, {
        title: item.title,
        rawNote: item.summary,
        source: 'notion',
        sourceUrl: item.sourceUrl || '',
        tags: item.tags,
      });
    }
    default:
      throw new Error('Unknown or disallowed tool');
  }
}
export async function queueTool(
  db: Database,
  conversationId: string,
  name: string,
  args: Record<string, unknown>,
) {
  if (!specs[name]) throw new Error('Tool not allowed');
  const [call] = await db
    .insert(s.assistantToolCalls)
    .values({ conversationId, name, arguments: args, status: 'pending' })
    .returning();
  return call;
}
export async function approveTool(
  db: Database,
  userId: string,
  provider: AIProvider,
  id: string,
  approved: boolean,
) {
  const [call] = await db
    .update(s.assistantToolCalls)
    .set({ status: approved ? 'executing' : 'rejected', updatedAt: new Date() })
    .where(
      and(
        eq(s.assistantToolCalls.id, id),
        eq(s.assistantToolCalls.status, 'pending'),
      ),
    )
    .returning();
  if (!call) throw new Error('This tool call has already been handled');
  if (!approved) return { rejected: true };
  try {
    // AI calls can pause for rate limits; do not hold a database transaction during them.
    const result = await executeTool(
      db,
      userId,
      provider,
      call.name,
      call.arguments,
    );
    await db.transaction(async (tx) => {
      await tx
        .update(s.assistantToolCalls)
        .set({ status: 'complete', result, updatedAt: new Date() })
        .where(eq(s.assistantToolCalls.id, call.id));
      await tx.insert(s.aiMessages).values({
        conversationId: call.conversationId,
        role: 'assistant',
        content: `Completed ${call.name}. Result: ${JSON.stringify(result)}`,
      });
    });
    return result;
  } catch (error) {
    await db
      .update(s.assistantToolCalls)
      .set({
        status: 'failed',
        result: {
          error: error instanceof Error ? error.message : 'Action failed',
        },
        updatedAt: new Date(),
      })
      .where(eq(s.assistantToolCalls.id, call.id));
    throw error;
  }
}

export async function assistantChat(
  db: Database,
  userId: string,
  provider: AIProvider,
  prompt: string,
  conversationId?: string,
) {
  z.string().trim().min(1).max(8000).parse(prompt);
  if (!conversationId) {
    const [conversation] = await db
      .insert(s.aiConversations)
      .values({ userId, title: prompt.slice(0, 100) })
      .returning();
    conversationId = conversation.id;
  } else {
    const [conversation] = await db
      .select()
      .from(s.aiConversations)
      .where(
        and(
          eq(s.aiConversations.id, z.uuid().parse(conversationId)),
          eq(s.aiConversations.userId, userId),
        ),
      );
    if (!conversation) throw new Error('Conversation not found');
  }
  await db
    .insert(s.aiMessages)
    .values({ conversationId, role: 'user', content: prompt });
  const history = await db
    .select()
    .from(s.aiMessages)
    .where(eq(s.aiMessages.conversationId, conversationId))
    .orderBy(desc(s.aiMessages.createdAt))
    .limit(20);
  const messages: AIMessageInput[] = [
    { role: 'system', content: await retrieveContext(db, prompt) },
    ...boundedHistory(
      history.reverse().map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ),
  ];
  let final = '';
  if (provider.name === 'mock') {
    const match = prompt.match(
      /^(?:create|save) (?:an? )?(idea|post)[: ]+(.+)/i,
    );
    if (match) {
      await queueTool(
        db,
        conversationId,
        match[1].toLowerCase() === 'idea' ? 'createIdea' : 'createPost',
        match[1].toLowerCase() === 'idea'
          ? { title: match[2], rawNote: match[2] }
          : { title: match[2], coreIdea: match[2] },
      );
      final =
        'Mock assistant: I prepared an action below. It has not run; review and approve it to save.';
    } else {
      await generate(db, provider, { messages }, 'chat', conversationId);
      final = `Mock assistant — no live model called.\n\nThree angles for “${prompt.slice(0, 160)}”:\n1. The founder lesson: describe the decision that changed your approach.\n2. The product question: what would make this a repeatable habit?\n3. The practical framework: compare the assumption, experiment and evidence.\n\nUse the application tool panel to save an idea, create a post or schedule a variant. Or type “Create idea: …”. Live Groq supports multi-turn natural-language tool selection.`;
    }
  } else {
    for (let step = 0; step < 3; step++) {
      if (estimateTokens({ messages, tools: assistantTools }) > 4800) {
        final =
          'The context budget for this turn is full. Recorded tool results are below; continue with a more specific request.';
        break;
      }
      const result = await generate(
        db,
        provider,
        { messages, tools: assistantTools },
        'chat',
        conversationId,
      );
      if (!result.toolCalls?.length) {
        final = result.text;
        break;
      }
      messages.push({
        role: 'assistant',
        content: result.text || null,
        tool_calls: result.toolCalls,
      });
      for (const tool of result.toolCalls) {
        let output: unknown;
        try {
          const args = z
            .record(z.string(), z.unknown())
            .parse(JSON.parse(tool.function.arguments));
          if (writeTools.has(tool.function.name)) {
            const queued = await queueTool(
              db,
              conversationId,
              tool.function.name,
              args,
            );
            output = {
              pendingApproval: true,
              id: queued.id,
              notice: 'NOT EXECUTED. User must approve.',
            };
          } else {
            output = await executeTool(
              db,
              userId,
              provider,
              tool.function.name,
              args,
            );
            await db.insert(s.assistantToolCalls).values({
              conversationId,
              name: tool.function.name,
              arguments: args,
              result: output,
              status: 'complete',
            });
          }
        } catch (error) {
          output = {
            error: error instanceof Error ? error.message : 'Tool failed',
          };
        }
        messages.push({
          role: 'tool',
          tool_call_id: tool.id,
          content: JSON.stringify(compactData(output, 500)),
        });
      }
      final =
        'Tool requests are recorded below. Pending actions need your approval.';
    }
  }
  await db.insert(s.aiMessages).values({
    conversationId,
    role: 'assistant',
    content:
      final || 'No response generated. No application action was performed.',
  });
  return { conversationId };
}
