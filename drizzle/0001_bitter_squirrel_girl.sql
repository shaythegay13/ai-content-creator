CREATE TABLE "assistant_tool_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversationId" uuid NOT NULL,
	"name" text NOT NULL,
	"arguments" jsonb NOT NULL,
	"result" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_post_relations" (
	"intelligenceId" uuid NOT NULL,
	"postId" uuid NOT NULL,
	CONSTRAINT "intelligence_post_relations_intelligenceId_postId_pk" PRIMARY KEY("intelligenceId","postId")
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intelligenceId" uuid NOT NULL,
	"title" text NOT NULL,
	"reason" text NOT NULL,
	"state" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opportunities_intelligenceId_unique" UNIQUE("intelligenceId")
);
--> statement-breakpoint
CREATE TABLE "suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variantId" uuid NOT NULL,
	"original" text NOT NULL,
	"suggested" text NOT NULL,
	"action" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"evidence" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mediaId" uuid NOT NULL,
	"text" text NOT NULL,
	"mock" boolean NOT NULL,
	"ideas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_editorial_reviews" DROP CONSTRAINT "daily_editorial_reviews_reviewDate_unique";--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "requestType" text DEFAULT 'chat' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "estimatedCost" text;--> statement-breakpoint
ALTER TABLE "content_posts" ADD COLUMN "coreIdea" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_posts" ADD COLUMN "pillar" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_posts" ADD COLUMN "notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_posts" ADD COLUMN "sourceReferences" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_editorial_reviews" ADD COLUMN "inputHash" text;--> statement-breakpoint
ALTER TABLE "intelligence_items" ADD COLUMN "notionUrl" text;--> statement-breakpoint
ALTER TABLE "intelligence_items" ADD COLUMN "rawText" text;--> statement-breakpoint
ALTER TABLE "intelligence_items" ADD COLUMN "entities" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "intelligence_items" ADD COLUMN "topics" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "intelligence_items" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "intelligence_items" ADD COLUMN "relevance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "intelligence_items" ADD COLUMN "relevanceReasons" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "intelligence_items" ADD COLUMN "dismissed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "intelligence_items" ADD COLUMN "processingStatus" text DEFAULT 'imported' NOT NULL;--> statement-breakpoint
ALTER TABLE "writing_profiles" ADD COLUMN "hookStyle" text;--> statement-breakpoint
ALTER TABLE "assistant_tool_calls" ADD CONSTRAINT "assistant_tool_calls_conversationId_ai_conversations_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_post_relations" ADD CONSTRAINT "intelligence_post_relations_intelligenceId_intelligence_items_id_fk" FOREIGN KEY ("intelligenceId") REFERENCES "public"."intelligence_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_post_relations" ADD CONSTRAINT "intelligence_post_relations_postId_content_posts_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."content_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_intelligenceId_intelligence_items_id_fk" FOREIGN KEY ("intelligenceId") REFERENCES "public"."intelligence_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_variantId_content_post_variants_id_fk" FOREIGN KEY ("variantId") REFERENCES "public"."content_post_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_mediaId_media_assets_id_fk" FOREIGN KEY ("mediaId") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_editorial_reviews" ADD CONSTRAINT "daily_editorial_reviews_inputHash_unique" UNIQUE("inputHash");