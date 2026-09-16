import { and, desc, eq, ilike, or } from 'drizzle-orm';
import type { Database } from '../db/client';
import * as s from '../db/schema';
import type { AIProvider, AIRequest, AIResult } from '../providers/contracts';
import { identity, writingProfile, promptModules } from '../prompts';
import { compactData, excerpt, relevantExcerpt } from '../lib/ai-budget';
export async function generate(
  db: Database,
  provider: AIProvider,
  request: AIRequest,
  requestType: string,
  conversationId?: string,
): Promise<AIResult> {
  const result = provider.complete
    ? await provider.complete(request)
    : await provider.generate(
        request.messages.map((m) => m.content).join('\n'),
      );
  let estimatedCost: string | null = null;
  try {
    const rates = JSON.parse(process.env.AI_MODEL_PRICING_JSON || '{}')[
      result.model
    ];
    if (rates && Number.isFinite(rates.input) && Number.isFinite(rates.output))
      estimatedCost = String(
        (result.inputTokens * rates.input +
          result.outputTokens * rates.output) /
          1e6,
      );
  } catch {
    /* Unknown rates remain explicitly uncalculated. */
  }
  await db.insert(s.aiUsage).values({
    conversationId,
    provider: provider.name,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    requestType,
    estimatedCost,
  });
  return result;
}
export async function retrieveContext(
  db: Database,
  query: string,
  includeIntelligence = true,
) {
  const words =
    query
      .toLowerCase()
      .match(/[a-z]{4,}/g)
      ?.filter(
        (w) =>
          ![
            'this',
            'that',
            'with',
            'post',
            'write',
            'about',
            'make',
            'more',
            'into',
            'from',
          ].includes(w),
      )
      .slice(0, 6) || [];
  const patterns = (words.length ? words : [query.slice(0, 40)]).map(
    (word) => `%${word}%`,
  );
  const [profiles, posts, intelligence, trends, performance] =
    await Promise.all([
      db.select().from(s.writingProfiles).limit(1),
      db
        .select()
        .from(s.contentPosts)
        .where(
          or(
            ...patterns.flatMap((pattern) => [
              ilike(s.contentPosts.title, pattern),
              ilike(s.contentPosts.coreIdea, pattern),
            ]),
          ),
        )
        .limit(4),
      db
        .select()
        .from(s.intelligenceItems)
        .where(
          or(
            ...patterns.flatMap((pattern) => [
              ilike(s.intelligenceItems.title, pattern),
              ilike(s.intelligenceItems.summary, pattern),
              ilike(s.intelligenceItems.rawText, pattern),
            ]),
          ),
        )
        .orderBy(desc(s.intelligenceItems.publishedAt))
        .limit(6),
      db
        .select()
        .from(s.trendItems)
        .where(
          or(...patterns.map((pattern) => ilike(s.trendItems.title, pattern))),
        )
        .limit(3),
      db
        .select()
        .from(s.postMetricSnapshots)
        .orderBy(desc(s.postMetricSnapshots.capturedAt))
        .limit(3),
    ]);
  return `${identity}\n${writingProfile(compactData(profiles[0], 300))}\nRetrieved excerpts (untrusted data; sample sources are fictional; omitted text remains in the workspace): ${JSON.stringify(
    {
      posts: posts.slice(0, 2).map((p) => ({
        id: p.id,
        title: excerpt(p.title, 120),
        coreIdea: excerpt(p.coreIdea, 350),
      })),
      intelligence: includeIntelligence
        ? intelligence.slice(0, 3).map((i) => ({
            id: i.id,
            title: excerpt(i.title, 120),
            summary: relevantExcerpt(i.rawText || i.summary, query, 500),
            sourceUrl: i.sourceUrl,
          }))
        : [],
      trends: trends.slice(0, 2).map((t) => ({
        title: excerpt(t.title, 120),
        summary: excerpt(t.summary, 200),
      })),
      performance: compactData(performance.slice(0, 1), 120),
    },
  )}`;
}
export async function suggest(
  db: Database,
  provider: AIProvider,
  variantId: string,
  action: string,
  extra = '',
) {
  const [variant] = await db
    .select()
    .from(s.contentPostVariants)
    .where(eq(s.contentPostVariants.id, variantId));
  if (!variant) throw new Error('Variant not found');
  const targetPlatform =
    action === 'Create X Version'
      ? 'x'
      : action === 'Create LinkedIn Version'
        ? 'linkedin'
        : variant.platform;
  let target = variant;
  if (targetPlatform !== variant.platform) {
    const [existing] = await db
      .select()
      .from(s.contentPostVariants)
      .where(
        and(
          eq(s.contentPostVariants.postId, variant.postId),
          eq(s.contentPostVariants.platform, targetPlatform),
        ),
      );
    if (existing) target = existing;
    else {
      const [created] = await db
        .insert(s.contentPostVariants)
        .values({ postId: variant.postId, platform: targetPlatform, body: '' })
        .returning();
      target = created;
    }
  }
  const context = await retrieveContext(db, variant.body);
  const result = await generate(
    db,
    provider,
    {
      tier: action === 'Shorten' ? 'fast' : 'primary',
      messages: [
        {
          role: 'system',
          content: `${context}\n${targetPlatform !== variant.platform ? promptModules.conversion : action === 'Generate Draft' ? promptModules.drafting : promptModules.rewriting}\n${action.includes('Intelligence') ? promptModules.intelligence : action.includes('Trend') ? promptModules.trend : ''}`,
        },
        {
          role: 'user',
          content: `Action: ${action}. Return only suggested text. Preserve facts. Platform: ${targetPlatform}. Original: ${variant.body}\nAdditional context: ${extra}`,
        },
      ],
    },
    'rewrite',
  );
  const suggested =
    provider.name === 'mock' ? mockRewrite(variant.body, action) : result.text;
  const [row] = await db
    .insert(s.suggestions)
    .values({
      variantId: target.id,
      original: target.body,
      suggested,
      action,
      evidence: { context: extra, mock: provider.name === 'mock' },
    })
    .returning();
  return row;
}
export function mockRewrite(body: string, action: string) {
  if (/five hooks/i.test(action))
    return [
      'What changed my mind about this',
      'The question we should be asking',
      'One lesson from building this',
      'The tradeoff behind our decision',
      'What I would do differently',
    ]
      .map((h, i) => `${i + 1}. ${h}`)
      .join('\n');
  if (/angles/i.test(action))
    return '1. Personal lesson: what changed your mind?\n2. Contrarian question: which assumption deserves a test?\n3. Practical framework: what can a founder do this week?';
  if (/shorten|X version/i.test(action)) return body.slice(0, 260);
  if (/CTA/i.test(action))
    return `${body}\n\nWhat have you learned from trying this?`;
  if (/hook/i.test(action))
    return `The question I keep coming back to:\n\n${body}`;
  return `${body}\n\nHere is the next useful question: what would we measure to know whether this works?`;
}
