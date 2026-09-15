'use server';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db/client';
import * as s from '@/db/schema';
import { requireUser } from '@/services/authentication';
import { providers } from '@/providers';
import {
  savePost,
  saveIdea,
  saveVariant,
  scheduleVariant,
  duplicatePost,
  convertIdea,
  attachMedia,
  archiveOrDelete,
} from '@/services/content';
import { runEditorialReview, decideReview } from '@/services/intelligence';
import { suggest, generate, retrieveContext } from '@/services/ai';
import {
  assistantChat,
  queueTool,
  approveTool,
  executeTool,
  writeTools,
} from '@/services/assistant';
import { validateUpload } from '@/services/validation';
import { timezone } from '@/lib/config';
import { dailyWorkflow } from '@/services/jobs';
import { promptModules } from '@/prompts';
export type ManageResult = { ok: boolean; message: string; data?: unknown };
export async function manage(
  action: string,
  input: Record<string, unknown>,
): Promise<ManageResult> {
  try {
    const user = await requireUser();
    const db = await getDb();
    let data: unknown;
    const id = () => z.uuid().parse(input.id);
    switch (action) {
      case 'savePost':
        data = await savePost(db, user.id, input);
        break;
      case 'saveIdea':
        data = await saveIdea(db, user.id, input);
        break;
      case 'saveVariant':
        data = await saveVariant(db, input);
        break;
      case 'schedule':
        data = await scheduleVariant(db, input);
        break;
      case 'duplicate':
        data = await duplicatePost(db, user.id, id());
        break;
      case 'archive':
      case 'delete':
        if (input.confirmed !== true) throw new Error('Confirmation required');
        data = await archiveOrDelete(db, id(), action);
        break;
      case 'convertIdea':
        data = await convertIdea(
          db,
          user.id,
          id(),
          String(input.platform || 'linkedin'),
        );
        break;
      case 'archiveIdea':
        if (input.confirmed !== true) throw new Error('Confirmation required');
        await db
          .update(s.contentIdeas)
          .set({ status: 'archived', updatedAt: new Date() })
          .where(eq(s.contentIdeas.id, id()));
        break;
      case 'attachMedia':
        data = await attachMedia(
          db,
          z.uuid().parse(input.postId),
          z.array(z.uuid()).parse(input.mediaIds),
        );
        break;
      case 'saveMedia': {
        const p = z
          .object({
            id: z.uuid(),
            description: z.string().max(5000),
            tags: z.array(z.string()),
            detectedTopics: z.array(z.string()),
          })
          .parse(input);
        await db
          .update(s.mediaAssets)
          .set({ ...p, updatedAt: new Date() })
          .where(eq(s.mediaAssets.id, p.id));
        break;
      }
      case 'saveTopic': {
        const name = z.string().trim().min(1).max(120).parse(input.name);
        if (input.id)
          await db
            .update(s.contentTopics)
            .set({ name })
            .where(eq(s.contentTopics.id, id()));
        else await db.insert(s.contentTopics).values({ name });
        break;
      }
      case 'deleteTopic':
        if (input.confirmed !== true) throw new Error('Confirmation required');
        await db.delete(s.contentTopics).where(eq(s.contentTopics.id, id()));
        break;
      case 'saveProfile': {
        const p = z
          .object({
            tone: z.string().min(1),
            sentenceStyle: z.string(),
            hookStyle: z.string(),
            formattingPreferences: z.string(),
            phrasesToAvoid: z.array(z.string()),
            preferredPhrases: z.array(z.string()),
            ctaStyle: z.string(),
            platformPreferences: z.record(z.string(), z.string()),
            topics: z.array(z.string()),
            personalInstructions: z.string().max(10000),
          })
          .parse(input);
        await db
          .update(s.writingProfiles)
          .set({ ...p, updatedAt: new Date() })
          .where(eq(s.writingProfiles.userId, user.id));
        break;
      }
      case 'sync':
        data = await dailyWorkflow(db, providers(), timezone());
        break;
      case 'review':
        data = await runEditorialReview(db, providers().ai, timezone());
        break;
      case 'decideReview':
        data = await decideReview(db, user.id, input);
        break;
      case 'suggest':
        data = await suggest(
          db,
          providers().ai,
          z.uuid().parse(input.variantId),
          z.string().max(200).parse(input.action),
          String(input.extra || ''),
        );
        break;
      case 'decideSuggestion': {
        const p = z
          .object({
            id: z.uuid(),
            decision: z.enum(['accepted', 'rejected', 'edited']),
            editedText: z.string().max(30000).optional(),
          })
          .parse(input);
        await db.transaction(async (tx) => {
          const [r] = await tx
            .select()
            .from(s.suggestions)
            .where(eq(s.suggestions.id, p.id));
          if (!r || r.state !== 'pending')
            throw new Error('Suggestion already handled');
          if (p.decision !== 'rejected') {
            const body = p.decision === 'edited' ? p.editedText : r.suggested;
            if (!body?.trim()) throw new Error('Suggested text is empty');
            const updated = await tx
              .update(s.contentPostVariants)
              .set({ body, approvedAt: new Date(), updatedAt: new Date() })
              .where(
                and(
                  eq(s.contentPostVariants.id, r.variantId),
                  eq(s.contentPostVariants.body, r.original),
                ),
              )
              .returning();
            if (!updated.length)
              throw new Error(
                'Post changed since generation. Generate a fresh suggestion.',
              );
          }
          await tx
            .update(s.suggestions)
            .set({
              state: p.decision,
              suggested: p.editedText || r.suggested,
              updatedAt: new Date(),
            })
            .where(eq(s.suggestions.id, r.id));
        });
        break;
      }
      case 'chat':
        data = await assistantChat(
          db,
          user.id,
          providers().ai,
          z.string().parse(input.prompt),
          input.conversationId
            ? z.uuid().parse(input.conversationId)
            : undefined,
        );
        break;
      case 'tool': {
        const name = z.string().parse(input.name);
        const args = z.record(z.string(), z.unknown()).parse(input.arguments);
        let conversationId = input.conversationId
          ? z.uuid().parse(input.conversationId)
          : undefined;
        if (!conversationId) {
          const [c] = await db
            .insert(s.aiConversations)
            .values({ userId: user.id, title: 'Application tools' })
            .returning();
          conversationId = c.id;
        }
        data = writeTools.has(name)
          ? await queueTool(db, conversationId, name, args)
          : await executeTool(db, user.id, providers().ai, name, args);
        if (!writeTools.has(name))
          await db.insert(s.assistantToolCalls).values({
            conversationId,
            name,
            arguments: args,
            result: data,
            status: 'complete',
          });
        data = { conversationId, result: data };
        break;
      }
      case 'approveTool':
        data = await approveTool(
          db,
          user.id,
          providers().ai,
          id(),
          input.approved === true,
        );
        break;
      case 'dismissIntelligence':
        await db
          .update(s.intelligenceItems)
          .set({ dismissed: input.dismissed === true, updatedAt: new Date() })
          .where(eq(s.intelligenceItems.id, id()));
        break;
      case 'opportunity': {
        const [op] = await db
          .select()
          .from(s.opportunities)
          .where(eq(s.opportunities.id, id()));
        if (!op) throw new Error('Opportunity not found');
        const [item] = await db
          .select()
          .from(s.intelligenceItems)
          .where(eq(s.intelligenceItems.id, op.intelligenceId));
        if (input.mode === 'idea') {
          data = await saveIdea(db, user.id, {
            title: item.title,
            rawNote: item.summary,
            source: 'notion',
            sourceUrl: item.sourceUrl || '',
          });
        } else if (input.mode === 'x' || input.mode === 'linkedin') {
          const post = await savePost(db, user.id, {
            title: item.title,
            coreIdea: item.summary,
            sourceReferences: item.sourceUrl ? [item.sourceUrl] : [],
          });
          await saveVariant(db, {
            postId: post.id,
            platform: input.mode,
            body: item.summary,
          });
          await db
            .insert(s.intelligencePostRelations)
            .values({ postId: post.id, intelligenceId: item.id });
          data = post;
        }
        await db
          .update(s.opportunities)
          .set({
            state:
              input.mode === 'dismiss'
                ? 'dismissed'
                : input.mode === 'later'
                  ? 'saved'
                  : 'used',
            updatedAt: new Date(),
          })
          .where(eq(s.opportunities.id, op.id));
        break;
      }
      case 'ideate': {
        const prompt = z.string().max(10000).parse(input.prompt);
        const provider = providers().ai;
        const result = await generate(
          db,
          provider,
          {
            messages: [
              {
                role: 'system',
                content: `${await retrieveContext(db, prompt)}\n${promptModules.ideation}`,
              },
              {
                role: 'user',
                content: `Return JSON {ideas:[{title,note}]} with 3 distinct ideas based on these notes, topics and pillars: ${prompt}`,
              },
            ],
            json: true,
          },
          'ideation',
        );
        data =
          provider.name === 'mock'
            ? [
                {
                  title: `Founder lesson: ${prompt.slice(0, 80)}`,
                  note: 'Explain one concrete decision, the tradeoff, and what you learned.',
                },
                {
                  title: `The assumption worth testing: ${prompt.slice(0, 70)}`,
                  note: 'Challenge one common assumption and propose a small experiment.',
                },
                {
                  title: `A practical framework: ${prompt.slice(0, 75)}`,
                  note: 'Break the topic into three steps your audience can try.',
                },
              ]
            : z
                .object({
                  ideas: z
                    .array(z.object({ title: z.string(), note: z.string() }))
                    .max(10),
                })
                .parse(JSON.parse(result.text)).ideas;
        break;
      }
      case 'saveTranscript': {
        const text = z.string().max(30000).parse(input.text);
        await db
          .update(s.transcripts)
          .set({ text, updatedAt: new Date() })
          .where(eq(s.transcripts.id, id()));
        break;
      }
      default:
        throw new Error('Unknown operation');
    }
    revalidatePath('/', 'layout');
    return { ok: true, message: 'Saved successfully.', data };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Operation failed.',
    };
  }
}
export async function processVoice(form: FormData): Promise<ManageResult> {
  try {
    const user = await requireUser();
    const file = form.get('file');
    if (!(file instanceof File) || !file.type.startsWith('audio/'))
      throw new Error('Choose an audio file');
    validateUpload(file.size, file.type);
    const p = providers();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await p.transcription.transcribe(bytes, file.type);
    const key = await p.storage.put(bytes, file.name);
    const db = await getDb();
    const [media] = await db
      .insert(s.mediaAssets)
      .values({
        userId: user.id,
        kind: 'audio',
        filename: file.name,
        storageKey: key,
        mimeType: file.type,
        size: file.size,
        description: 'Voice note',
      })
      .returning();
    const [transcript] = await db
      .insert(s.transcripts)
      .values({ mediaId: media.id, text: result.text, mock: result.mock })
      .returning();
    await db.insert(s.aiUsage).values({
      provider: result.mock ? 'mock' : 'groq',
      model: result.mock
        ? 'mock-transcription'
        : process.env.AI_TRANSCRIPTION_MODEL!,
      requestType: 'transcription',
    });
    revalidatePath('/', 'layout');
    return {
      ok: true,
      message: result.mock
        ? 'Mock transcript ready for editing.'
        : 'Transcript ready for editing.',
      data: transcript,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Transcription failed',
    };
  }
}
