# Fieldnotes

A private, single-user content workspace. This repository implements the **local foundation stage**, not a public SaaS or a connected publishing application.

## Run locally (Windows PowerShell)

Requires Node.js 22+ and npm. Tested on Node 24.19.0. No Docker, PostgreSQL service, API keys, or accounts are needed.

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run db:seed
npm.cmd run dev
```

Open **http://127.0.0.1:3000**. `npm` works on other shells; use `npm.cmd` if PowerShell blocks `npm.ps1`. Do not overwrite an existing `.env.local` when following these instructions a second time.

`LOCAL_DEV_MODE=true` automatically uses the development owner. The app defaults to local mode under `next dev` when no environment file exists. The dev/start scripts bind to loopback because local mode intentionally bypasses login. Never expose local mode through a public tunnel. Local mode is rejected on Vercel.

Migrations and an idempotent seed also run automatically at the first local database access. Data persists under `.local/postgres`; uploaded bytes live under `.local/media`. These paths and all real environment files are Git-ignored. **Run only one app/database process against a given local data directory at a time.** Stop the dev server before running database CLI commands or backing up `.local`. Optional `LOCAL_DATA_DIR` selects a different directory.

For a local production-build smoke test:

```powershell
npm.cmd run build
npm.cmd run start
```

Keep `.env.local` with `LOCAL_DEV_MODE=true` for this local-only test.

## What works now

- Responsive desktop/mobile shell with Home, Morning Review, Calendar, Ideas, Posts, Media, Intelligence, Trends, Analytics, AI Assistant and Settings.
- Dashboard reads real local database records: today's schedule, pipeline, sample briefing, opportunities, unused media, performance and recommendations.
- Create persistent ideas and draft concepts; X and LinkedIn variants belong to the same post.
- Search post titles/bodies, ideas, media filenames/descriptions/tags and intelligence.
- Upload images/video/audio up to 20 MB; retrieve bytes through an authenticated route. File keys are generated and path traversal is rejected. Three seeded media entries are **metadata examples**, with no underlying file.
- Save tone and personal writing instructions; all other requested profile fields exist in the schema.
- Persistent mock assistant conversations and usage records.
- Manually sync sample intelligence and prepare an idempotent daily sample review. Review records preserve original text, reasons and evidence snapshots. Accept/reject/ignore records a decision only: it does not edit, schedule or publish anything.
- Mock publishing explicitly requires approval and always returns a simulated result. It is not exposed as a publish button.

The first seed creates four ideas, six post concepts, twelve platform variants, two scheduled entries, two simulated historical publications with metrics, three media examples, three sample Notion brief items, three trends and two sample AI recommendations. Scheduled dates are anchored to the first seed day and are intentionally not moved on later starts. A later day may correctly show an empty calendar.

## Architecture

```text
app/                  App Router pages, server actions, private media/Auth.js routes
components/           Server-rendered workspace views, interactive forms and shell
components/ui/        shadcn-style Radix/CVA button primitive
db/                   PostgreSQL schema, adapter selection and idempotent seed
drizzle/              Checked-in generated SQL migration and snapshots
lib/                  Environment/timezone configuration and UI utilities
providers/            Replaceable provider contracts, composition root and mocks
services/             Authentication, workspace queries, editorial workflow, validation
types/                Extensible domain categories and platform/source definitions
scripts/              Database migration/seed entry point
tests/                PostgreSQL/provider tests and Edge browser workflow test
```

Next.js 16.3.5 App Router, React 19.3, strict TypeScript, Tailwind CSS 4, Drizzle and PostgreSQL. The local adapter uses PGlite, an embedded PostgreSQL engine, rather than a separate SQLite schema or in-memory JSON. The production adapter is prepared for Neon. Database and provider access stays on the server; components never receive credentials. The interface uses system fonts so building does not need a font download.

Provider contracts: `AIProvider`, `TranscriptionProvider`, `MediaUnderstandingProvider`, `MediaStorageProvider`, `SocialPublisher`, `SocialAnalyticsProvider`, `TrendSource`, `IntelligenceSourceProvider`, `ChatChannel`, and `AuthenticationProvider`.

**Scope interpretation:** the brief requests Groq selection when a key exists, but also explicitly says not to implement external integrations at this stage. This foundation honors the latter: AI remains mocked even if `GROQ_API_KEY` is populated. No credential triggers an external request. Groq selection is an explicit next-stage TODO, not silently claimed as complete. Gemini, R2, Notion, X, LinkedIn and Telegram have contracts/environment placeholders, not functioning external adapters.

## Database model

29 tables, UUID entity identifiers, timezone-aware timestamps, foreign keys, indexes and uniqueness constraints. Association tables use composite foreign-key primary keys; `AppSetting` uses its unique setting key.

| Area         | Tables                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| Owner        | users                                                                                                                |
| Content      | content_ideas, content_posts, content_post_variants, content_calendar_entries, content_topics, post_topics           |
| Media        | media_assets, media_post_relations, idea_media_relations                                                             |
| Publishing   | published_posts, post_metric_snapshots                                                                               |
| Intelligence | intelligence_items, intelligence_entities, intelligence_topics, intelligence_item_entities, intelligence_item_topics |
| Trends       | trend_items, trend_insights                                                                                          |
| AI           | ai_conversations, ai_messages, ai_recommendations, ai_usage                                                          |
| Editorial    | daily_editorial_reviews, daily_editorial_post_reviews, editorial_supporting_intelligence, recommendation_decisions   |
| Settings     | writing_profiles, app_settings                                                                                       |

Post/variant statuses: idea, draft, review, ready, scheduled, published, archived. Calendar entries reference variants, so platform timing can differ. Each concept has at most one variant per platform. Platforms and intelligence categories use extensible text; recommendation and decision types use enums.

Editorial recommendations support KEEP, MINOR_UPDATE, MAJOR_UPDATE, REPLACE and CONSIDER_ADDITIONAL_POST. Decisions support accepted, rejected, edited and ignored with an audit trail. The sample runner emits KEEP only. Nullable variant links support supplemental posts and retain history if a variant is deleted. Evidence snapshots retain the reviewed context even if source records change. Database relationships cascade for owned children and use set-null for historical/optional references. Services explicitly update `updatedAt` on edits.

## Database commands

```powershell
npm.cmd run db:generate             # Generate migration from schema changes
npm.cmd run db:migrate              # Local migrations + idempotent seed
npm.cmd run db:seed                 # Same safe local initializer
npm.cmd run db:migrate:production   # Requires DATABASE_URL; no sample seed
```

For the eventual Neon environment: create a database, place its connection string in `DATABASE_URL`, inspect the generated SQL, and run `db:migrate:production`. **No Neon instance has been provisioned or tested.** Production sample seeding is deliberately unavailable.

Auth.js is scaffolded with Google and JWT sessions. Future production setup requires `AUTH_SECRET`, Google credentials and `OWNER_EMAIL`; sign-in only accepts that exact verified email. An owner row must also be provisioned in `users`. Production onboarding, login UX and deployment are not complete. Production provider composition fails closed until the external adapters are implemented. This is not ready for Vercel deployment yet.

## Verification

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run format:check
npm.cmd run test:e2e
```

The integration tests create a separate in-memory PostgreSQL instance, apply the checked-in migration, seed it, and test referential integrity, idempotency, approval isolation, mock providers, storage bytes/path traversal, upload validation and timezone boundaries. The browser test uses installed Microsoft Edge (`channel: msedge`); switch the channel/install Chromium if Edge is unavailable. Stop your regular dev server before running it (Next.js permits one dev process per project). It starts an isolated server on port 3100 with a fresh `.local/e2e-<timestamp>` database, checks reload persistence and private media retrieval, exercises review/chat/settings, checks console errors and mobile navigation, and writes screenshots under `.local/`. It does not change your normal workspace data.

The dependency override upgrades Drizzle Kit's old transitive esbuild dependency to a patched version; migration generation is checked after this override. Auth.js currently uses its v5 beta package for App Router integration. `package-lock.json` records exact installed versions.

## Next stages / attention

1. Add Groq chat/transcription selection, model configuration, timeouts, usage tracking and error handling. Add Gemini media analysis only when needed.
2. Add Notion ingestion, normalization, source URLs, deduplication updates and sync cursors. Current intelligence is fictional sample data.
3. Implement post editing, validation per platform, scheduling controls and the actual editorial-analysis pipeline. Editing a recommendation must preserve original/revised text and explicit approval.
4. Implement R2 storage, then production auth/owner provisioning and Neon verification before deployment.
5. Add external social publishing/analytics and optional Telegram only in an authorized later stage; use idempotent jobs and approval checks.
6. Add a real morning scheduler later; `DAILY_INTELLIGENCE_REVIEW_TIME` is a configuration placeholder. No cron job runs now.
7. Initialize a GitHub remote and push when requested. This stage creates a local Git commit only.

Reference architecture: [Drizzle PGlite adapter](https://orm.drizzle.team/docs/connect-pglite), [Next.js Server Actions](https://nextjs.org/docs/app/getting-started/updating-data), [Auth.js](https://authjs.dev/).
