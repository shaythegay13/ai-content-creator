import { and, desc, eq, ilike, ne, or } from 'drizzle-orm';
import type { Database } from '../db/client';
import * as s from '../db/schema';
import { excerpt, estimateTokens, relevantExcerpt } from '../lib/ai-budget';

const stop = new Set(
  'this that with from have about someone today said could interesting talked into what when then them they their than should would there been very just more idea draft post make using'.split(
    ' ',
  ),
);
export const terms = (text: string) =>
  [
    ...new Set(
      (text.toLowerCase().match(/[a-z]{4,}/g) || []).filter(
        (w) => !stop.has(w),
      ),
    ),
  ].slice(0, 12);
export const relevance = (text: string, query: string) =>
  terms(query).filter((w) => text.toLowerCase().includes(w)).length;
export function repetitionScore(a: string, b: string) {
  const left = new Set(terms(a));
  const right = new Set(terms(b));
  if (left.size < 5 || right.size < 5) return 0;
  return (
    [...left].filter((w) => right.has(w)).length /
    Math.max(left.size, right.size)
  );
}
export type ContextRecord = {
  type: string;
  id: string;
  text: string;
  sourceUrl?: string | null;
  date?: string;
  status?: string;
  evidence?: string;
};
export type ContextPacket = {
  records: ContextRecord[];
  missing: string[];
  intendedDate: string;
  pillar: string;
  performanceNote: string;
};
export function performancePatterns(
  rows: {
    id: string;
    platform: string;
    body: string;
    impressions: number;
    likes: number;
    comments: number;
    shares: number;
  }[],
) {
  const patterns: ContextRecord[] = [];
  for (const platform of [...new Set(rows.map((r) => r.platform))]) {
    const eligible = rows.filter(
      (r) => r.platform === platform && r.impressions >= 100,
    );
    const personal = eligible.filter((r) => /\b(I|my)\b/i.test(r.body));
    const other = eligible.filter((r) => !/\b(I|my)\b/i.test(r.body));
    if (personal.length < 5 || other.length < 5) continue;
    const rate = (group: typeof rows) =>
      (
        (100 * group.reduce((n, r) => n + r.likes + r.comments + r.shares, 0)) /
        group.reduce((n, r) => n + r.impressions, 0)
      ).toFixed(2);
    patterns.push({
      type: 'performancePattern',
      id: platform,
      text: `${platform}: first-person wording (${personal.length} posts) ${rate(personal)}% aggregate engagement/impression rate; other wording (${other.length} posts) ${rate(other)}%. Descriptive association only; wording is a heuristic, not a content classification. No causal or engagement prediction.`,
      status: 'genuine-publications',
    });
  }
  return patterns;
}

export class ContentContextService {
  constructor(private db: Database) {}
  async assemble(source: string, postId?: string): Promise<ContextPacket> {
    const db = this.db;
    const words = terms(source);
    // SQL limits bound retrieval before ranking. Empty queries match no contextual records.
    const patterns = (words.length ? words : ['__no_topic__']).map(
      (w) => `%${w}%`,
    );
    const [
      profiles,
      writing,
      knowledge,
      posts,
      recent,
      intel,
      trends,
      decisions,
      scheduled,
      post,
      editorialDecisions,
    ] = await Promise.all([
      db.select().from(s.contentProfiles),
      db.select().from(s.writingProfiles).limit(1),
      db
        .select()
        .from(s.knowledgeItems)
        .where(or(...patterns.map((p) => ilike(s.knowledgeItems.statement, p))))
        .orderBy(desc(s.knowledgeItems.updatedAt))
        .limit(30),
      db
        .select()
        .from(s.contentPosts)
        .where(
          and(
            postId ? ne(s.contentPosts.id, postId) : undefined,
            or(
              ...patterns.flatMap((p) => [
                ilike(s.contentPosts.coreIdea, p),
                ilike(s.contentPosts.title, p),
              ]),
            ),
          ),
        )
        .orderBy(desc(s.contentPosts.createdAt))
        .limit(15),
      db
        .select()
        .from(s.contentPostVariants)
        .where(
          and(
            postId ? ne(s.contentPostVariants.postId, postId) : undefined,
            ne(s.contentPostVariants.body, ''),
          ),
        )
        .orderBy(desc(s.contentPostVariants.updatedAt))
        .limit(5),
      db
        .select()
        .from(s.intelligenceItems)
        .where(
          and(
            eq(s.intelligenceItems.dismissed, false),
            or(
              ...patterns.flatMap((p) => [
                ilike(s.intelligenceItems.title, p),
                ilike(s.intelligenceItems.summary, p),
                ilike(s.intelligenceItems.rawText, p),
              ]),
            ),
          ),
        )
        .orderBy(desc(s.intelligenceItems.publishedAt))
        .limit(15),
      db
        .select()
        .from(s.trendItems)
        .where(
          or(
            ...patterns.flatMap((p) => [
              ilike(s.trendItems.title, p),
              ilike(s.trendItems.summary, p),
            ]),
          ),
        )
        .orderBy(desc(s.trendItems.observedAt))
        .limit(8),
      db
        .select()
        .from(s.suggestions)
        .where(
          and(
            ne(s.suggestions.state, 'pending'),
            or(...patterns.map((p) => ilike(s.suggestions.suggested, p))),
          ),
        )
        .orderBy(desc(s.suggestions.updatedAt))
        .limit(2),
      postId
        ? db
            .select({ at: s.contentCalendarEntries.scheduledAt })
            .from(s.contentCalendarEntries)
            .innerJoin(
              s.contentPostVariants,
              eq(s.contentPostVariants.id, s.contentCalendarEntries.variantId),
            )
            .where(eq(s.contentPostVariants.postId, postId))
            .limit(1)
        : Promise.resolve([]),
      postId
        ? db
            .select()
            .from(s.contentPosts)
            .where(eq(s.contentPosts.id, postId))
            .limit(1)
        : Promise.resolve([]),
      db
        .select({
          id: s.recommendationDecisions.id,
          decision: s.recommendationDecisions.decision,
          note: s.recommendationDecisions.note,
          reasons: s.dailyEditorialPostReviews.reasons,
        })
        .from(s.recommendationDecisions)
        .innerJoin(
          s.dailyEditorialPostReviews,
          eq(
            s.dailyEditorialPostReviews.id,
            s.recommendationDecisions.postReviewId,
          ),
        )
        .where(
          or(
            ...patterns.map((p) =>
              ilike(s.dailyEditorialPostReviews.originalText, p),
            ),
          ),
        )
        .orderBy(desc(s.recommendationDecisions.createdAt))
        .limit(2),
    ]);
    const records: ContextRecord[] = [];
    const missing = ['user', 'company', 'strategy'].filter(
      (kind) =>
        !profiles.some(
          (p) => p.kind === kind && Object.values(p.fields).some(Boolean),
        ),
    );
    for (const p of profiles) {
      const nonempty = Object.entries(p.fields).filter(([, v]) => v.trim());
      const important = [
        'approvedClaims',
        'framingsToAvoid',
        'avoidTopics',
        'contentToAvoid',
        'primaryGoals',
        'targetAudiences',
      ];
      nonempty.sort(
        ([a], [b]) =>
          (important.includes(a) ? important.indexOf(a) : 99) -
          (important.includes(b) ? important.indexOf(b) : 99),
      );
      const perField = Math.max(
        35,
        Math.min(180, Math.floor(650 / Math.max(1, nonempty.length))),
      );
      if (nonempty.length)
        records.push({
          type: p.kind + 'Profile',
          id: p.kind,
          text: JSON.stringify(
            Object.fromEntries(
              nonempty.map(([k, v]) => [
                k,
                relevantExcerpt(v, source, perField),
              ]),
            ),
          ),
        });
    }
    if (writing[0])
      records.push({
        type: 'writingProfile',
        id: writing[0].id,
        text: JSON.stringify(
          Object.fromEntries(
            Object.entries(writing[0])
              .filter(
                ([k]) =>
                  !['id', 'userId', 'createdAt', 'updatedAt'].includes(k),
              )
              .map(([k, v]) => [
                k,
                excerpt(
                  typeof v === 'string' ? v : JSON.stringify(v),
                  k === 'personalInstructions' ? 120 : 70,
                ),
              ]),
          ),
        ),
      });
    const ranked = <T>(rows: T[], text: (v: T) => string, limit: number) =>
      rows
        .filter((v) => relevance(text(v), source) > 0)
        .sort((a, b) => relevance(text(b), source) - relevance(text(a), source))
        .slice(0, limit);
    for (const k of ranked(knowledge, (k) => k.statement, 4))
      records.push({
        type: 'knowledge',
        id: k.id,
        status: k.confidence,
        evidence: excerpt(k.evidence, 300),
        date: k.updatedAt.toISOString(),
        text:
          excerpt(k.statement, 300) +
          ` [${k.kind}; ${k.confidence}; evidence: ${excerpt(k.evidence, 180)}]`,
      });
    for (const p of ranked(posts, (p) => p.title + ' ' + p.coreIdea, 2))
      records.push({
        type: 'historicalPost',
        id: p.id,
        text: excerpt(p.title + ': ' + p.coreIdea, 350),
      });
    for (const p of recent.slice(0, 3))
      records.push({
        type: 'recentPost',
        id: p.id,
        text: excerpt(p.body, 350),
        status: p.status,
      });
    for (const i of ranked(
      intel,
      (i) => i.title + ' ' + (i.rawText || i.summary),
      2,
    ))
      records.push({
        type: 'intelligence',
        id: i.id,
        text:
          excerpt(i.title, 100) +
          ': ' +
          relevantExcerpt(i.rawText || i.summary, source, 450),
        sourceUrl: i.sourceUrl || i.notionUrl,
        date: i.publishedAt?.toISOString(),
        status: i.source,
      });
    for (const t of ranked(trends, (t) => t.title + ' ' + t.summary, 1))
      records.push({
        type: 'trend',
        id: t.id,
        text: excerpt(t.title + ': ' + t.summary, 300),
        sourceUrl: t.sourceUrl,
        date: t.observedAt.toISOString(),
        status: t.source,
      });
    for (const d of decisions)
      records.push({
        type: 'contentDecision',
        id: d.id,
        text: excerpt(d.action + ': ' + d.suggested, 250),
        status: d.state,
      });
    for (const d of editorialDecisions)
      records.push({
        type: 'contentDecision',
        id: d.id,
        status: d.decision,
        text: excerpt([d.note, ...d.reasons].filter(Boolean).join('; '), 300),
      });
    // Distinct genuine publications only; seeded simulated metrics cannot establish a pattern.
    const metrics = await db
      .select({
        id: s.postMetricSnapshots.id,
        publication: s.publishedPosts.id,
        platform: s.publishedPosts.platform,
        impressions: s.postMetricSnapshots.impressions,
        likes: s.postMetricSnapshots.likes,
        comments: s.postMetricSnapshots.comments,
        shares: s.postMetricSnapshots.shares,
        body: s.contentPostVariants.body,
      })
      .from(s.postMetricSnapshots)
      .innerJoin(
        s.publishedPosts,
        eq(s.publishedPosts.id, s.postMetricSnapshots.publishedPostId),
      )
      .innerJoin(
        s.contentPostVariants,
        eq(s.contentPostVariants.id, s.publishedPosts.variantId),
      )
      .where(eq(s.publishedPosts.simulated, false))
      .orderBy(desc(s.postMetricSnapshots.capturedAt))
      .limit(100);
    const distinct = [
      ...new Map(
        [...metrics].reverse().map((m) => [m.publication, m]),
      ).values(),
    ].filter((m) => m.impressions >= 100);
    let performanceNote =
      'Insufficient genuine performance data. Do not infer a performance pattern.';
    if (distinct.length >= 10) {
      performanceNote = `${distinct.length} distinct genuine posts with at least 100 impressions; descriptive evidence only, not causal or predictive. Avoid comparing across platforms.`;
      for (const m of distinct
        .filter((m) => relevance(m.body, source))
        .slice(0, 3))
        records.push({
          type: 'performance',
          id: m.id,
          text: `${m.platform}: ${excerpt(m.body, 160)}; impressions=${m.impressions}, engagements=${m.likes + m.comments + m.shares}`,
        });
      records.push(...performancePatterns(distinct));
    }
    const packet: ContextPacket = {
      records,
      missing,
      intendedDate: (scheduled[0]?.at || new Date()).toISOString().slice(0, 10),
      pillar: post[0]?.pillar || '',
      performanceNote,
    };
    const priority: Record<string, number> = {
      userProfile: 0,
      companyProfile: 0,
      strategyProfile: 0,
      preferencesProfile: 0,
      writingProfile: 0,
      intelligence: 1,
      performancePattern: 1,
      recentPost: 2,
      knowledge: 3,
      contentDecision: 3,
      trend: 3,
      historicalPost: 4,
      performance: 4,
    };
    packet.records.sort(
      (a, b) => (priority[a.type] ?? 5) - (priority[b.type] ?? 5),
    );
    // Keep actual inspector records identical to model inputs, with a firm total envelope.
    for (const record of packet.records)
      record.text = excerpt(
        record.text,
        record.type.endsWith('Profile') ? 1000 : 650,
      );
    while (estimateTokens(packet) > 1700 && packet.records.length)
      packet.records.pop();
    return packet;
  }
}
