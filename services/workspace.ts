import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import * as s from '../db/schema';
import { requireUser } from './authentication';
import { getGenerationSettings } from './generation-settings';
export async function getWorkspace() {
  await requireUser();
  const db = await getDb();
  const [
    posts,
    variants,
    calendar,
    ideas,
    media,
    intelligence,
    trends,
    metrics,
    published,
    recommendations,
    reviews,
    postReviews,
    decisions,
    profiles,
    messages,
  ] = await Promise.all([
    db.select().from(s.contentPosts).orderBy(desc(s.contentPosts.createdAt)),
    db.select().from(s.contentPostVariants),
    db.select().from(s.contentCalendarEntries),
    db.select().from(s.contentIdeas).orderBy(desc(s.contentIdeas.createdAt)),
    db.select().from(s.mediaAssets).orderBy(desc(s.mediaAssets.createdAt)),
    db
      .select()
      .from(s.intelligenceItems)
      .orderBy(desc(s.intelligenceItems.publishedAt)),
    db.select().from(s.trendItems).orderBy(desc(s.trendItems.score)),
    db.select().from(s.postMetricSnapshots),
    db.select().from(s.publishedPosts),
    db.select().from(s.aiRecommendations),
    db
      .select()
      .from(s.dailyEditorialReviews)
      .orderBy(desc(s.dailyEditorialReviews.createdAt)),
    db.select().from(s.dailyEditorialPostReviews),
    db
      .select()
      .from(s.recommendationDecisions)
      .orderBy(desc(s.recommendationDecisions.createdAt)),
    db.select().from(s.writingProfiles),
    db.select().from(s.aiMessages).orderBy(s.aiMessages.createdAt),
  ]);
  const [
    topics,
    postMedia,
    ideaMedia,
    usage,
    conversations,
    toolCalls,
    suggestions,
    opportunities,
    transcripts,
    syncRuns,
    intelligencePosts,
  ] = await Promise.all([
    db.select().from(s.contentTopics),
    db.select().from(s.mediaPostRelations),
    db.select().from(s.ideaMediaRelations),
    db.select().from(s.aiUsage).orderBy(desc(s.aiUsage.createdAt)),
    db
      .select()
      .from(s.aiConversations)
      .orderBy(desc(s.aiConversations.createdAt)),
    db
      .select()
      .from(s.assistantToolCalls)
      .orderBy(s.assistantToolCalls.createdAt),
    db.select().from(s.suggestions).orderBy(desc(s.suggestions.createdAt)),
    db.select().from(s.opportunities),
    db.select().from(s.transcripts).orderBy(desc(s.transcripts.createdAt)),
    db.select().from(s.syncRuns).orderBy(desc(s.syncRuns.createdAt)),
    db.select().from(s.intelligencePostRelations),
  ]);
  return {
    generationSettings: await getGenerationSettings(db),
    posts,
    variants,
    calendar,
    ideas,
    media,
    intelligence,
    trends,
    metrics,
    published,
    recommendations,
    reviews,
    postReviews,
    decisions,
    profile: profiles[0],
    messages,
    topics,
    postMedia,
    ideaMedia,
    usage,
    conversations,
    toolCalls,
    suggestions,
    opportunities,
    transcripts,
    syncRuns,
    intelligencePosts,
  };
}
export type Workspace = Awaited<ReturnType<typeof getWorkspace>>;
export async function getMedia(id: string) {
  await requireUser();
  const db = await getDb();
  const [media] = await db
    .select()
    .from(s.mediaAssets)
    .where(eq(s.mediaAssets.id, id));
  return media;
}
