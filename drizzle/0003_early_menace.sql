ALTER TABLE "content_post_variants" ADD COLUMN "hashtags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "content_post_variants" ADD COLUMN "generationStatus" text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_post_variants" ADD COLUMN "generationError" text;