CREATE TYPE "public"."decision_kind" AS ENUM('accepted', 'rejected', 'edited', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('idea', 'draft', 'review', 'ready', 'scheduled', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."recommendation_kind" AS ENUM('KEEP', 'MINOR_UPDATE', 'MAJOR_UPDATE', 'REPLACE', 'CONSIDER_ADDITIONAL_POST');--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversationId" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"postId" uuid,
	"title" text NOT NULL,
	"reason" text NOT NULL,
	"mock" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversationId" uuid,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"inputTokens" integer DEFAULT 0 NOT NULL,
	"outputTokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_calendar_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variantId" uuid NOT NULL,
	"scheduledAt" timestamp with time zone NOT NULL,
	"timezone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_calendar_entries_variantId_unique" UNIQUE("variantId")
);
--> statement-breakpoint
CREATE TABLE "content_ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"title" text NOT NULL,
	"rawNote" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"topicId" uuid,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"priority" integer DEFAULT 2 NOT NULL,
	"sourceUrl" text,
	"status" text DEFAULT 'inbox' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_post_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"postId" uuid NOT NULL,
	"platform" text NOT NULL,
	"body" text NOT NULL,
	"status" "post_status" DEFAULT 'draft' NOT NULL,
	"approvedAt" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"ideaId" uuid,
	"title" text NOT NULL,
	"status" "post_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "content_topics_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "daily_editorial_post_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reviewId" uuid NOT NULL,
	"variantId" uuid,
	"recommendation" "recommendation_kind" NOT NULL,
	"reasons" text[] NOT NULL,
	"originalText" text NOT NULL,
	"suggestedRevision" text,
	"evidenceSnapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_editorial_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reviewDate" text NOT NULL,
	"timezone" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"mock" boolean DEFAULT true NOT NULL,
	"context" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_editorial_reviews_reviewDate_unique" UNIQUE("reviewDate")
);
--> statement-breakpoint
CREATE TABLE "editorial_supporting_intelligence" (
	"postReviewId" uuid NOT NULL,
	"intelligenceItemId" uuid NOT NULL,
	CONSTRAINT "editorial_supporting_intelligence_postReviewId_intelligenceItemId_pk" PRIMARY KEY("postReviewId","intelligenceItemId")
);
--> statement-breakpoint
CREATE TABLE "idea_media_relations" (
	"mediaId" uuid NOT NULL,
	"ideaId" uuid NOT NULL,
	CONSTRAINT "idea_media_relations_mediaId_ideaId_pk" PRIMARY KEY("mediaId","ideaId")
);
--> statement-breakpoint
CREATE TABLE "intelligence_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_item_entities" (
	"itemId" uuid NOT NULL,
	"entityId" uuid NOT NULL,
	CONSTRAINT "intelligence_item_entities_itemId_entityId_pk" PRIMARY KEY("itemId","entityId")
);
--> statement-breakpoint
CREATE TABLE "intelligence_item_topics" (
	"itemId" uuid NOT NULL,
	"topicId" uuid NOT NULL,
	CONSTRAINT "intelligence_item_topics_itemId_topicId_pk" PRIMARY KEY("itemId","topicId")
);
--> statement-breakpoint
CREATE TABLE "intelligence_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"externalId" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"category" text NOT NULL,
	"sourceUrl" text,
	"importance" integer DEFAULT 2 NOT NULL,
	"publishedAt" timestamp with time zone NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "intelligence_topics_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"kind" text NOT NULL,
	"filename" text NOT NULL,
	"storageKey" text NOT NULL,
	"storageProvider" text DEFAULT 'local' NOT NULL,
	"mimeType" text NOT NULL,
	"size" integer NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"detectedTopics" text[] DEFAULT '{}' NOT NULL,
	"usageStatus" text DEFAULT 'unused' NOT NULL,
	"metadata" jsonb,
	"aiAnalysis" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_storageKey_unique" UNIQUE("storageKey")
);
--> statement-breakpoint
CREATE TABLE "media_post_relations" (
	"mediaId" uuid NOT NULL,
	"postId" uuid NOT NULL,
	CONSTRAINT "media_post_relations_mediaId_postId_pk" PRIMARY KEY("mediaId","postId")
);
--> statement-breakpoint
CREATE TABLE "post_metric_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publishedPostId" uuid NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"capturedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_topics" (
	"postId" uuid NOT NULL,
	"topicId" uuid NOT NULL,
	CONSTRAINT "post_topics_postId_topicId_pk" PRIMARY KEY("postId","topicId")
);
--> statement-breakpoint
CREATE TABLE "published_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variantId" uuid NOT NULL,
	"externalId" text NOT NULL,
	"platform" text NOT NULL,
	"url" text,
	"simulated" boolean DEFAULT true NOT NULL,
	"publishedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"postReviewId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"decision" "decision_kind" NOT NULL,
	"editedText" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trend_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trendId" uuid NOT NULL,
	"insight" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trend_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"externalId" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"sourceUrl" text,
	"score" integer NOT NULL,
	"observedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "writing_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"tone" text NOT NULL,
	"sentenceStyle" text,
	"formattingPreferences" text,
	"phrasesToAvoid" text[] DEFAULT '{}',
	"preferredPhrases" text[] DEFAULT '{}',
	"ctaStyle" text,
	"platformPreferences" jsonb,
	"topics" text[] DEFAULT '{}',
	"personalInstructions" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "writing_profiles_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_ai_conversations_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_postId_content_posts_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."content_posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_conversationId_ai_conversations_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."ai_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_calendar_entries" ADD CONSTRAINT "content_calendar_entries_variantId_content_post_variants_id_fk" FOREIGN KEY ("variantId") REFERENCES "public"."content_post_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_ideas" ADD CONSTRAINT "content_ideas_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_ideas" ADD CONSTRAINT "content_ideas_topicId_content_topics_id_fk" FOREIGN KEY ("topicId") REFERENCES "public"."content_topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_post_variants" ADD CONSTRAINT "content_post_variants_postId_content_posts_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."content_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_ideaId_content_ideas_id_fk" FOREIGN KEY ("ideaId") REFERENCES "public"."content_ideas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_editorial_post_reviews" ADD CONSTRAINT "daily_editorial_post_reviews_reviewId_daily_editorial_reviews_id_fk" FOREIGN KEY ("reviewId") REFERENCES "public"."daily_editorial_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_editorial_post_reviews" ADD CONSTRAINT "daily_editorial_post_reviews_variantId_content_post_variants_id_fk" FOREIGN KEY ("variantId") REFERENCES "public"."content_post_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_supporting_intelligence" ADD CONSTRAINT "editorial_supporting_intelligence_postReviewId_daily_editorial_post_reviews_id_fk" FOREIGN KEY ("postReviewId") REFERENCES "public"."daily_editorial_post_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_supporting_intelligence" ADD CONSTRAINT "editorial_supporting_intelligence_intelligenceItemId_intelligence_items_id_fk" FOREIGN KEY ("intelligenceItemId") REFERENCES "public"."intelligence_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_media_relations" ADD CONSTRAINT "idea_media_relations_mediaId_media_assets_id_fk" FOREIGN KEY ("mediaId") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_media_relations" ADD CONSTRAINT "idea_media_relations_ideaId_content_ideas_id_fk" FOREIGN KEY ("ideaId") REFERENCES "public"."content_ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_item_entities" ADD CONSTRAINT "intelligence_item_entities_itemId_intelligence_items_id_fk" FOREIGN KEY ("itemId") REFERENCES "public"."intelligence_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_item_entities" ADD CONSTRAINT "intelligence_item_entities_entityId_intelligence_entities_id_fk" FOREIGN KEY ("entityId") REFERENCES "public"."intelligence_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_item_topics" ADD CONSTRAINT "intelligence_item_topics_itemId_intelligence_items_id_fk" FOREIGN KEY ("itemId") REFERENCES "public"."intelligence_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_item_topics" ADD CONSTRAINT "intelligence_item_topics_topicId_intelligence_topics_id_fk" FOREIGN KEY ("topicId") REFERENCES "public"."intelligence_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_post_relations" ADD CONSTRAINT "media_post_relations_mediaId_media_assets_id_fk" FOREIGN KEY ("mediaId") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_post_relations" ADD CONSTRAINT "media_post_relations_postId_content_posts_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."content_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_metric_snapshots" ADD CONSTRAINT "post_metric_snapshots_publishedPostId_published_posts_id_fk" FOREIGN KEY ("publishedPostId") REFERENCES "public"."published_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_topics" ADD CONSTRAINT "post_topics_postId_content_posts_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."content_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_topics" ADD CONSTRAINT "post_topics_topicId_content_topics_id_fk" FOREIGN KEY ("topicId") REFERENCES "public"."content_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_posts" ADD CONSTRAINT "published_posts_variantId_content_post_variants_id_fk" FOREIGN KEY ("variantId") REFERENCES "public"."content_post_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_decisions" ADD CONSTRAINT "recommendation_decisions_postReviewId_daily_editorial_post_reviews_id_fk" FOREIGN KEY ("postReviewId") REFERENCES "public"."daily_editorial_post_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_decisions" ADD CONSTRAINT "recommendation_decisions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trend_insights" ADD CONSTRAINT "trend_insights_trendId_trend_items_id_fk" FOREIGN KEY ("trendId") REFERENCES "public"."trend_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "writing_profiles" ADD CONSTRAINT "writing_profiles_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "schedule_time_idx" ON "content_calendar_entries" USING btree ("scheduledAt");--> statement-breakpoint
CREATE UNIQUE INDEX "variant_platform_unique" ON "content_post_variants" USING btree ("postId","platform");--> statement-breakpoint
CREATE INDEX "posts_status_idx" ON "content_posts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_name_kind" ON "intelligence_entities" USING btree ("name","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "intelligence_source_unique" ON "intelligence_items" USING btree ("source","externalId");--> statement-breakpoint
CREATE INDEX "intelligence_date_idx" ON "intelligence_items" USING btree ("publishedAt");--> statement-breakpoint
CREATE INDEX "metrics_post_time_idx" ON "post_metric_snapshots" USING btree ("publishedPostId","capturedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "publication_external_unique" ON "published_posts" USING btree ("platform","externalId");--> statement-breakpoint
CREATE UNIQUE INDEX "trend_source_unique" ON "trend_items" USING btree ("source","externalId");