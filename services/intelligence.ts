import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import type {
  IntelligenceSourceProvider,
  AIProvider,
} from '../providers/contracts';
import * as s from '../db/schema';
import { createHash } from 'node:crypto';
import { dayKey } from './editorial';
import { generate, retrieveContext } from './ai';
import { promptModules } from '../prompts';
import { z } from 'zod';
import { excerpt, relevantExcerpt } from '../lib/ai-budget';
import {
  validatePlatform,
  assertPlatform,
  hashtagsIn,
} from '../lib/platform-validation';
export function scoreItem(
  item: {
    title: string;
    summary: string;
    category: string;
    publishedAt: Date | null;
    importance: number;
  },
  topics: string[],
  scheduledText: string,
  recentTitles: string[],
) {
  let score = 0;
  const reasons: string[] = [];
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const matching = topics.filter((t) => {
    const escaped = t.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`).test(text);
  });
  if (matching.length) {
    score += 30;
    reasons.push(`Matches content topics: ${matching.join(', ')}`);
  }
  const words = text.match(/[a-z]{5,}/g) || [];
  if (words.some((w) => scheduledText.toLowerCase().includes(w))) {
    score += 20;
    reasons.push('Overlaps with scheduled content');
  }
  if (
    item.publishedAt &&
    Date.now() - item.publishedAt.getTime() < 3 * 86400000
  ) {
    score += 15;
    reasons.push('Published within three days');
  }
  if (/regulation|legislation|academic/.test(item.category)) {
    score += 20;
    reasons.push('Research or policy significance');
  }
  if (item.importance >= 3) {
    score += 10;
    reasons.push('High source importance');
  }
  if (/playmind|prediction.market|sportsbook|sports.betting/.test(text)) {
    score += 10;
    reasons.push('Relevant to PlayMind-related themes');
  }
  if (recentTitles.some((t) => t.toLowerCase() === item.title.toLowerCase())) {
    score -= 20;
    reasons.push('Exact topic title recently covered: reduced priority');
  }
  reasons.push('Source quality is unverified; no quality bonus applied');
  return {
    relevance: Math.max(0, Math.min(100, score)),
    relevanceReasons: reasons,
  };
}
export async function syncIntelligenceItems(
  db: Database,
  source: IntelligenceSourceProvider,
) {
  const [run] = await db
    .insert(s.syncRuns)
    .values({ source: source.constructor.name, status: 'running' })
    .returning();
  try {
    const items = await source.fetch();
    const topics = await db.select().from(s.contentTopics);
    const posts = await db.select().from(s.contentPosts);
    const variants = await db.select().from(s.contentPostVariants);
    let count = 0;
    await db.transaction(async (tx) => {
      for (const item of items) {
        const scoring = scoreItem(
          item,
          topics.map((t) => t.name),
          variants
            .filter((v) => v.status === 'scheduled')
            .map((v) => v.body)
            .join(' '),
          posts.filter((p) => p.status === 'published').map((p) => p.title),
        );
        const [row] = await tx
          .insert(s.intelligenceItems)
          .values({ ...item, ...scoring })
          .onConflictDoUpdate({
            target: [
              s.intelligenceItems.source,
              s.intelligenceItems.externalId,
            ],
            set: { ...item, ...scoring, updatedAt: new Date() },
          })
          .returning();
        if (scoring.relevance >= 35)
          await tx
            .insert(s.opportunities)
            .values({
              intelligenceId: row.id,
              title: `A new angle: ${row.title}`,
              reason: scoring.relevanceReasons.join('. '),
            })
            .onConflictDoUpdate({
              target: s.opportunities.intelligenceId,
              set: {
                title: `A new angle: ${row.title}`,
                reason: scoring.relevanceReasons.join('. '),
              },
            });
        count++;
      }
    });
    await db
      .update(s.syncRuns)
      .set({ status: 'complete', count, updatedAt: new Date() })
      .where(eq(s.syncRuns.id, run.id));
    return { count };
  } catch (error) {
    await db
      .update(s.syncRuns)
      .set({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Sync failed',
        updatedAt: new Date(),
      })
      .where(eq(s.syncRuns.id, run.id));
    throw error;
  }
}
const reviewResult = z.object({
  recommendation: z.enum(['KEEP', 'MINOR_UPDATE', 'MAJOR_UPDATE', 'REPLACE']),
  reasons: z.array(z.string()).min(1),
  suggestedRevision: z.string().nullable(),
  evidenceIds: z.array(z.string()),
});
export async function reviewOne(
  db: Database,
  provider: AIProvider,
  variant: typeof s.contentPostVariants.$inferSelect,
) {
  const all = await db
    .select()
    .from(s.intelligenceItems)
    .where(eq(s.intelligenceItems.dismissed, false))
    .orderBy(desc(s.intelligenceItems.relevance))
    .limit(30);
  const generic = new Set([
    'should',
    'before',
    'because',
    'useful',
    'question',
    'content',
    'cannot',
    'making',
    'sample',
    'founder',
    'product',
    'personal',
    'sharing',
    'process',
    'building',
    'enough',
    'coming',
    'decision',
  ]);
  const words = (variant.body.toLowerCase().match(/[a-z]{6,}/g) || []).filter(
    (w) => !generic.has(w),
  );
  const evidence = all
    .filter((i) =>
      words.some((w) =>
        `${i.title} ${i.summary} ${i.rawText}`.toLowerCase().includes(w),
      ),
    )
    .slice(0, 3);
  let result: z.infer<typeof reviewResult>;
  if (provider.name === 'mock') {
    const item =
      evidence.find((i) => /legislation|regulation/.test(i.category)) ||
      evidence[0];
    const kind = !item
      ? 'KEEP'
      : /legislation|regulation/.test(item.category)
        ? 'MAJOR_UPDATE'
        : /sportsbook|prediction_market/.test(item.category)
          ? 'MINOR_UPDATE'
          : 'KEEP';
    result = {
      recommendation: kind,
      reasons: [
        item
          ? `Mock review: “${item.title}” overlaps with this draft. ${kind === 'MAJOR_UPDATE' ? 'Policy context deserves a careful revision.' : kind === 'MINOR_UPDATE' ? 'Consider adding the brief as a contextual example.' : 'The supplied brief does not materially change this draft.'}`
          : 'Insufficient related intelligence; preserve the original.',
      ],
      suggestedRevision:
        kind === 'KEEP'
          ? null
          : `${variant.body}\n\nA point worth checking against the latest brief: ${item?.summary}`,
      evidenceIds: item ? [item.id] : [],
    };
  } else if (!evidence.length) {
    result = {
      recommendation: 'KEEP',
      reasons: [
        'Insufficient related intelligence; preserve the original. No AI request needed.',
      ],
      suggestedRevision: null,
      evidenceIds: [],
    };
  } else {
    const request = {
      json: true,
      maxOutputTokens: 1800,
      messages: [
        {
          role: 'system' as const,
          content: `${await retrieveContext(db, variant.body, false)}\n${promptModules.editorial}`,
        },
        {
          role: 'user' as const,
          content: JSON.stringify({
            variant: {
              id: variant.id,
              platform: variant.platform,
              body: variant.body,
            },
            evidence: evidence.map((i) => ({
              id: i.id,
              title: excerpt(i.title, 160),
              summary: excerpt(i.summary, 500),
              rawText: relevantExcerpt(i.rawText, variant.body, 900),
              sourceUrl: i.sourceUrl,
              notionUrl: i.notionUrl,
            })),
          }),
        },
      ],
    };
    const cacheKey =
      'editorial-cache:' +
      createHash('sha256')
        .update(
          JSON.stringify({
            request,
            provider: provider.name,
            model: process.env.AI_PRIMARY_MODEL,
            effort: process.env.AI_REASONING_EFFORT,
            evidence: evidence.map((i) => [i.id, i.rawText, i.summary]),
          }),
        )
        .digest('hex');
    const [cached] = await db
      .select()
      .from(s.appSettings)
      .where(eq(s.appSettings.key, cacheKey));
    result = cached
      ? reviewResult.parse(cached.value)
      : reviewResult.parse(
          JSON.parse((await generate(db, provider, request, 'editorial')).text),
        );
    if (result.evidenceIds.some((id) => !evidence.some((i) => i.id === id)))
      throw new Error(
        'AI cited evidence that was not provided. Review not saved.',
      );
    if (
      result.recommendation !== 'KEEP' &&
      (!result.evidenceIds.length || !result.suggestedRevision)
    )
      throw new Error(
        'A revision requires supplied evidence and suggested text.',
      );
    if (!cached)
      await db
        .insert(s.appSettings)
        .values({ key: cacheKey, value: result })
        .onConflictDoNothing();
  }
  if (
    result.suggestedRevision &&
    !validatePlatform(variant.platform, result.suggestedRevision).valid
  ) {
    const { draftPlatform } = await import('./platform-generation');
    result.suggestedRevision = (
      await draftPlatform(
        db,
        provider,
        variant.platform as 'x' | 'linkedin',
        result.suggestedRevision,
        'Compress revision, preserving evidence and factual meaning',
      )
    ).body;
  }
  return {
    ...result,
    evidence: evidence.filter((i) => result.evidenceIds.includes(i.id)),
  };
}
export async function runEditorialReview(
  db: Database,
  provider: AIProvider,
  zone: string,
) {
  const date = dayKey(new Date(), zone);
  const scheduled = await db
    .select({ variant: s.contentPostVariants, entry: s.contentCalendarEntries })
    .from(s.contentCalendarEntries)
    .innerJoin(
      s.contentPostVariants,
      eq(s.contentPostVariants.id, s.contentCalendarEntries.variantId),
    );
  const today = scheduled.filter(
    (x) =>
      x.variant.status === 'scheduled' &&
      dayKey(x.entry.scheduledAt, zone) === date,
  );
  const intelligence = await db
    .select()
    .from(s.intelligenceItems)
    .where(eq(s.intelligenceItems.dismissed, false));
  const hash = createHash('sha256')
    .update(
      JSON.stringify({
        date,
        today: today.map((x) => [
          x.variant.id,
          x.variant.body,
          x.entry.scheduledAt,
        ]),
        intelligence: intelligence.map((i) => [
          i.id,
          i.title,
          i.summary,
          i.rawText,
          i.category,
          i.sourceUrl,
          i.notionUrl,
        ]),
        provider: provider.name,
        model: process.env.AI_PRIMARY_MODEL || 'mock',
      }),
    )
    .digest('hex');
  const [existing] = await db
    .select()
    .from(s.dailyEditorialReviews)
    .where(eq(s.dailyEditorialReviews.inputHash, hash));
  if (existing) return existing;
  const results: {
    row: (typeof today)[number];
    result: Awaited<ReturnType<typeof reviewOne>>;
  }[] = [];
  for (const row of today)
    results.push({ row, result: await reviewOne(db, provider, row.variant) });
  return db.transaction(async (tx) => {
    const [review] = await tx
      .insert(s.dailyEditorialReviews)
      .values({
        reviewDate: date,
        inputHash: hash,
        timezone: zone,
        status: today.length ? 'awaiting_decisions' : 'no_scheduled_posts',
        mock: provider.name === 'mock',
        context: {
          intelligenceCount: intelligence.length,
          scheduledCount: today.length,
        },
      })
      .onConflictDoNothing()
      .returning();
    if (!review) {
      const [found] = await tx
        .select()
        .from(s.dailyEditorialReviews)
        .where(eq(s.dailyEditorialReviews.inputHash, hash));
      return found;
    }
    for (const { row, result } of results) {
      const [r] = await tx
        .insert(s.dailyEditorialPostReviews)
        .values({
          reviewId: review.id,
          variantId: row.variant.id,
          recommendation: result.recommendation,
          reasons: result.reasons,
          originalText: row.variant.body,
          suggestedRevision: result.suggestedRevision,
          evidenceSnapshot: result.evidence,
        })
        .returning();
      if (result.evidence.length)
        await tx.insert(s.editorialSupportingIntelligence).values(
          result.evidence.map((i) => ({
            postReviewId: r.id,
            intelligenceItemId: i.id,
          })),
        );
    }
    const important = intelligence.filter((i) => i.relevance >= 50).slice(0, 3);
    for (const item of important)
      await tx.insert(s.dailyEditorialPostReviews).values({
        reviewId: review.id,
        recommendation: 'CONSIDER_ADDITIONAL_POST',
        reasons: item.relevanceReasons.length
          ? item.relevanceReasons
          : ['Relevant intelligence deserves a separate angle.'],
        originalText: '',
        suggestedRevision: null,
        evidenceSnapshot: [item],
      });
    return review;
  });
}
export async function decideReview(
  db: Database,
  userId: string,
  input: unknown,
) {
  const p = z
    .object({
      id: z.uuid(),
      decision: z.enum(['accepted', 'rejected', 'edited', 'ignored']),
      editedText: z.string().max(30000).optional(),
    })
    .parse(input);
  return db.transaction(async (tx) => {
    const [r] = await tx
      .select()
      .from(s.dailyEditorialPostReviews)
      .where(eq(s.dailyEditorialPostReviews.id, p.id));
    if (!r) throw new Error('Review not found');
    if (
      (p.decision === 'accepted' || p.decision === 'edited') &&
      r.variantId &&
      r.suggestedRevision
    ) {
      const [v] = await tx
        .select()
        .from(s.contentPostVariants)
        .where(eq(s.contentPostVariants.id, r.variantId));
      if (!v || v.body !== r.originalText)
        throw new Error(
          'Post changed since this review. Run a new review before accepting.',
        );
      const body = p.decision === 'edited' ? p.editedText : r.suggestedRevision;
      if (!body?.trim()) throw new Error('Revision cannot be empty');
      assertPlatform(v.platform, body);
      const updated = await tx
        .update(s.contentPostVariants)
        .set({
          body,
          hashtags: hashtagsIn(body),
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(s.contentPostVariants.id, v.id),
            eq(s.contentPostVariants.body, r.originalText),
          ),
        )
        .returning();
      if (!updated.length) throw new Error('Concurrent edit detected');
    }
    await tx.insert(s.recommendationDecisions).values({
      postReviewId: r.id,
      userId,
      decision: p.decision,
      editedText: p.editedText,
      note: 'Explicit user decision; no external publication.',
    });
    return { saved: true };
  });
}
