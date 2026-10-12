import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
const id = () => uuid('id').primaryKey().defaultRandom();
const dates = () => ({
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const postStatus = pgEnum('post_status', [
  'idea',
  'draft',
  'review',
  'ready',
  'scheduled',
  'published',
  'archived',
]);
export const recommendationKind = pgEnum('recommendation_kind', [
  'KEEP',
  'MINOR_UPDATE',
  'MAJOR_UPDATE',
  'REPLACE',
  'CONSIDER_ADDITIONAL_POST',
]);
export const decisionKind = pgEnum('decision_kind', [
  'accepted',
  'rejected',
  'edited',
  'ignored',
]);
export const users = pgTable('users', {
  id: id(),
  name: text().notNull(),
  email: text().notNull().unique(),
  ...dates(),
});
export const contentTopics = pgTable('content_topics', {
  id: id(),
  name: text().notNull().unique(),
});
export const contentIdeas = pgTable('content_ideas', {
  id: id(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text().notNull(),
  rawNote: text().notNull(),
  source: text().notNull().default('manual'),
  topicId: uuid().references(() => contentTopics.id, { onDelete: 'set null' }),
  tags: text().array().notNull().default([]),
  priority: integer().notNull().default(2),
  sourceUrl: text(),
  status: text().notNull().default('inbox'),
  ...dates(),
});
export const contentPosts = pgTable(
  'content_posts',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ideaId: uuid().references(() => contentIdeas.id, { onDelete: 'set null' }),
    title: text().notNull(),
    status: postStatus().notNull().default('draft'),
    coreIdea: text().notNull().default(''),
    pillar: text().notNull().default(''),
    notes: text().notNull().default(''),
    sourceReferences: text().array().notNull().default([]),
    ...dates(),
  },
  (t) => [index('posts_status_idx').on(t.status)],
);
export const contentPostVariants = pgTable(
  'content_post_variants',
  {
    id: id(),
    postId: uuid()
      .notNull()
      .references(() => contentPosts.id, { onDelete: 'cascade' }),
    platform: text().notNull(),
    body: text().notNull(),
    hashtags: jsonb().$type<string[]>().notNull().default([]),
    generationStatus: text().notNull().default('idle'),
    generationError: text(),
    status: postStatus().notNull().default('draft'),
    approvedAt: timestamp({ withTimezone: true }),
    ...dates(),
  },
  (t) => [uniqueIndex('variant_platform_unique').on(t.postId, t.platform)],
);
export const contentCalendarEntries = pgTable(
  'content_calendar_entries',
  {
    id: id(),
    variantId: uuid()
      .notNull()
      .unique()
      .references(() => contentPostVariants.id, { onDelete: 'cascade' }),
    scheduledAt: timestamp({ withTimezone: true }).notNull(),
    timezone: text().notNull(),
    ...dates(),
  },
  (t) => [index('schedule_time_idx').on(t.scheduledAt)],
);
export const postTopics = pgTable(
  'post_topics',
  {
    postId: uuid()
      .notNull()
      .references(() => contentPosts.id, { onDelete: 'cascade' }),
    topicId: uuid()
      .notNull()
      .references(() => contentTopics.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.topicId] })],
);
export const mediaAssets = pgTable('media_assets', {
  id: id(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  kind: text().notNull(),
  filename: text().notNull(),
  storageKey: text().notNull().unique(),
  storageProvider: text().notNull().default('local'),
  mimeType: text().notNull(),
  size: integer().notNull(),
  description: text().notNull().default(''),
  tags: text().array().notNull().default([]),
  detectedTopics: text().array().notNull().default([]),
  usageStatus: text().notNull().default('unused'),
  metadata: jsonb().$type<Record<string, unknown>>(),
  aiAnalysis: jsonb(),
  ...dates(),
});
export const mediaPostRelations = pgTable(
  'media_post_relations',
  {
    mediaId: uuid()
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'cascade' }),
    postId: uuid()
      .notNull()
      .references(() => contentPosts.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.mediaId, t.postId] })],
);
export const ideaMediaRelations = pgTable(
  'idea_media_relations',
  {
    mediaId: uuid()
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'cascade' }),
    ideaId: uuid()
      .notNull()
      .references(() => contentIdeas.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.mediaId, t.ideaId] })],
);
export const publishedPosts = pgTable(
  'published_posts',
  {
    id: id(),
    variantId: uuid()
      .notNull()
      .references(() => contentPostVariants.id, { onDelete: 'cascade' }),
    externalId: text().notNull(),
    platform: text().notNull(),
    url: text(),
    simulated: boolean().notNull().default(true),
    publishedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex('publication_external_unique').on(t.platform, t.externalId),
  ],
);
export const postMetricSnapshots = pgTable(
  'post_metric_snapshots',
  {
    id: id(),
    publishedPostId: uuid()
      .notNull()
      .references(() => publishedPosts.id, { onDelete: 'cascade' }),
    impressions: integer().notNull().default(0),
    likes: integer().notNull().default(0),
    comments: integer().notNull().default(0),
    shares: integer().notNull().default(0),
    clicks: integer().notNull().default(0),
    capturedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('metrics_post_time_idx').on(t.publishedPostId, t.capturedAt)],
);
export const intelligenceItems = pgTable(
  'intelligence_items',
  {
    id: id(),
    source: text().notNull(),
    externalId: text().notNull(),
    title: text().notNull(),
    summary: text().notNull(),
    category: text().notNull(),
    sourceUrl: text(),
    importance: integer().notNull().default(2),
    publishedAt: timestamp({ withTimezone: true }),
    metadata: jsonb(),
    notionUrl: text(),
    rawText: text(),
    entities: text().array().notNull().default([]),
    topics: text().array().notNull().default([]),
    tags: text().array().notNull().default([]),
    relevance: integer().notNull().default(0),
    relevanceReasons: text().array().notNull().default([]),
    dismissed: boolean().notNull().default(false),
    processingStatus: text().notNull().default('imported'),
    ...dates(),
  },
  (t) => [
    uniqueIndex('intelligence_source_unique').on(t.source, t.externalId),
    index('intelligence_date_idx').on(t.publishedAt),
  ],
);
export const intelligenceEntities = pgTable(
  'intelligence_entities',
  { id: id(), name: text().notNull(), kind: text().notNull() },
  (t) => [uniqueIndex('entity_name_kind').on(t.name, t.kind)],
);
export const intelligenceTopics = pgTable('intelligence_topics', {
  id: id(),
  name: text().notNull().unique(),
});
export const intelligenceItemEntities = pgTable(
  'intelligence_item_entities',
  {
    itemId: uuid()
      .notNull()
      .references(() => intelligenceItems.id, { onDelete: 'cascade' }),
    entityId: uuid()
      .notNull()
      .references(() => intelligenceEntities.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.entityId] })],
);
export const intelligenceItemTopics = pgTable(
  'intelligence_item_topics',
  {
    itemId: uuid()
      .notNull()
      .references(() => intelligenceItems.id, { onDelete: 'cascade' }),
    topicId: uuid()
      .notNull()
      .references(() => intelligenceTopics.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.topicId] })],
);
export const trendItems = pgTable(
  'trend_items',
  {
    id: id(),
    source: text().notNull(),
    externalId: text().notNull(),
    title: text().notNull(),
    summary: text().notNull(),
    sourceUrl: text(),
    score: integer().notNull(),
    observedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('trend_source_unique').on(t.source, t.externalId)],
);
export const trendInsights = pgTable('trend_insights', {
  id: id(),
  trendId: uuid()
    .notNull()
    .references(() => trendItems.id, { onDelete: 'cascade' }),
  insight: text().notNull(),
  ...dates(),
});
export const aiConversations = pgTable('ai_conversations', {
  id: id(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text().notNull(),
  ...dates(),
});
export const aiMessages = pgTable('ai_messages', {
  id: id(),
  conversationId: uuid()
    .notNull()
    .references(() => aiConversations.id, { onDelete: 'cascade' }),
  role: text().notNull(),
  content: text().notNull(),
  ...dates(),
});
export const aiRecommendations = pgTable('ai_recommendations', {
  id: id(),
  postId: uuid().references(() => contentPosts.id, { onDelete: 'set null' }),
  title: text().notNull(),
  reason: text().notNull(),
  mock: boolean().notNull().default(true),
  ...dates(),
});
export const aiUsage = pgTable('ai_usage', {
  id: id(),
  conversationId: uuid().references(() => aiConversations.id, {
    onDelete: 'set null',
  }),
  provider: text().notNull(),
  model: text().notNull(),
  inputTokens: integer().notNull().default(0),
  outputTokens: integer().notNull().default(0),
  requestType: text().notNull().default('chat'),
  estimatedCost: text(),
  ...dates(),
});
export const dailyEditorialReviews = pgTable('daily_editorial_reviews', {
  id: id(),
  reviewDate: text().notNull(),
  inputHash: text().unique(),
  timezone: text().notNull(),
  status: text().notNull().default('pending'),
  mock: boolean().notNull().default(true),
  context: jsonb(),
  ...dates(),
});
export const dailyEditorialPostReviews = pgTable(
  'daily_editorial_post_reviews',
  {
    id: id(),
    reviewId: uuid()
      .notNull()
      .references(() => dailyEditorialReviews.id, { onDelete: 'cascade' }),
    variantId: uuid().references(() => contentPostVariants.id, {
      onDelete: 'set null',
    }),
    recommendation: recommendationKind().notNull(),
    reasons: text().array().notNull(),
    originalText: text().notNull(),
    suggestedRevision: text(),
    evidenceSnapshot: jsonb(),
    ...dates(),
  },
);
export const editorialSupportingIntelligence = pgTable(
  'editorial_supporting_intelligence',
  {
    postReviewId: uuid()
      .notNull()
      .references(() => dailyEditorialPostReviews.id, { onDelete: 'cascade' }),
    intelligenceItemId: uuid()
      .notNull()
      .references(() => intelligenceItems.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.postReviewId, t.intelligenceItemId] })],
);
export const recommendationDecisions = pgTable('recommendation_decisions', {
  id: id(),
  postReviewId: uuid()
    .notNull()
    .references(() => dailyEditorialPostReviews.id, { onDelete: 'cascade' }),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  decision: decisionKind().notNull(),
  editedText: text(),
  note: text(),
  ...dates(),
});
export const writingProfiles = pgTable('writing_profiles', {
  id: id(),
  userId: uuid()
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  tone: text().notNull(),
  sentenceStyle: text(),
  hookStyle: text(),
  formattingPreferences: text(),
  phrasesToAvoid: text().array().default([]),
  preferredPhrases: text().array().default([]),
  ctaStyle: text(),
  platformPreferences: jsonb().$type<Record<string, string>>(),
  topics: text().array().default([]),
  personalInstructions: text(),
  ...dates(),
});
export const appSettings = pgTable('app_settings', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  ...dates(),
});
// User-authored context is separate from writing style and inferred knowledge.
export const contentProfiles = pgTable('content_profiles', {
  kind: text().primaryKey(),
  fields: jsonb().$type<Record<string, string>>().notNull().default({}),
  ...dates(),
});
export const knowledgeItems = pgTable(
  'knowledge_items',
  {
    id: id(),
    sourceKey: text().notNull(),
    sourceHash: text().notNull(),
    kind: text().notNull(),
    statement: text().notNull(),
    confidence: text().notNull(),
    evidence: text().notNull(),
    entities: text().array().notNull().default([]),
    themes: text().array().notNull().default([]),
    ...dates(),
  },
  (t) => [index('knowledge_source_idx').on(t.sourceKey)],
);
export const contentBriefs = pgTable('content_briefs', {
  id: id(),
  postId: uuid().references(() => contentPosts.id, { onDelete: 'set null' }),
  cacheKey: text().notNull().unique(),
  source: text().notNull(),
  brief: jsonb().$type<Record<string, unknown>>().notNull(),
  context: jsonb().$type<Record<string, unknown>>().notNull(),
  ...dates(),
});
export const draftAssessments = pgTable('draft_assessments', {
  id: id(),
  briefId: uuid()
    .notNull()
    .references(() => contentBriefs.id, { onDelete: 'cascade' }),
  platform: text().notNull(),
  draft: text().notNull(),
  critique: jsonb().$type<Record<string, unknown>>().notNull(),
  revised: boolean().notNull().default(false),
  ...dates(),
});
export const suggestions = pgTable('suggestions', {
  id: id(),
  variantId: uuid()
    .notNull()
    .references(() => contentPostVariants.id, { onDelete: 'cascade' }),
  original: text().notNull(),
  suggested: text().notNull(),
  action: text().notNull(),
  state: text().notNull().default('pending'),
  evidence: jsonb(),
  ...dates(),
});
export const opportunities = pgTable('opportunities', {
  id: id(),
  intelligenceId: uuid()
    .notNull()
    .unique()
    .references(() => intelligenceItems.id, { onDelete: 'cascade' }),
  title: text().notNull(),
  reason: text().notNull(),
  state: text().notNull().default('new'),
  ...dates(),
});
export const intelligencePostRelations = pgTable(
  'intelligence_post_relations',
  {
    intelligenceId: uuid()
      .notNull()
      .references(() => intelligenceItems.id, { onDelete: 'cascade' }),
    postId: uuid()
      .notNull()
      .references(() => contentPosts.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.intelligenceId, t.postId] })],
);
export const transcripts = pgTable('transcripts', {
  id: id(),
  mediaId: uuid()
    .notNull()
    .references(() => mediaAssets.id, { onDelete: 'cascade' }),
  text: text().notNull(),
  mock: boolean().notNull(),
  ideas: jsonb()
    .$type<{ title: string; note: string }[]>()
    .notNull()
    .default([]),
  ...dates(),
});
export const assistantToolCalls = pgTable('assistant_tool_calls', {
  id: id(),
  conversationId: uuid()
    .notNull()
    .references(() => aiConversations.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  arguments: jsonb().$type<Record<string, unknown>>().notNull(),
  result: jsonb(),
  status: text().notNull().default('pending'),
  ...dates(),
});
export const syncRuns = pgTable('sync_runs', {
  id: id(),
  source: text().notNull(),
  status: text().notNull(),
  count: integer().notNull().default(0),
  error: text(),
  ...dates(),
});
