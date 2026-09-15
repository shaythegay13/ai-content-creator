# Fieldnotes

Private, single-user content management and content intelligence workspace. Stage 2 adds working editorial workflows, Groq adapters and read-only Notion ingestion. X and LinkedIn publishing remain disabled.

## Run locally

Requires Node.js 22+ (tested with 24.19.0). No Docker, database service or API keys are needed for the mock workflow.

```powershell
npm.cmd install
# Only on first setup; preserve an existing .env.local:
Copy-Item .env.example .env.local
npm.cmd run dev
```

Open http://127.0.0.1:3000. Use `npm` on other shells. The Windows scripts bind to loopback. Local development automatically signs in as the owner; keep this mode private. `LOCAL_DEV_MODE=true` is required when using `npm.cmd run build` followed by `npm.cmd run start`. Public production operation is not enabled.

Migrations and idempotent seeds run on first database access. Persistent PostgreSQL data is in `.local/postgres`, media in `.local/media`; both are Git-ignored. `LOCAL_DATA_DIR` can override the root. Run only one process against a given data directory, and stop the app before database CLI commands or backups. Seed schedules use the first seed day in `APP_TIMEZONE`; later starts preserve dates and user changes.

## Working flows

- Calendar: month, week and agenda; create from a date, drag entries to reschedule, and open the editor for precise platform times, duplication, archive and deletion.
- Ideas and posts: persistent CRUD, filters, idea conversion, concept/core idea/pillar/notes/sources, separate X and LinkedIn variants, media attachments and status management.
- Editor: platform rewriting and conversion with original/suggested comparison, accept/reject/edit, and explicit scheduling. Actions cannot mark variants as published.
- Media: local image previews, audio/video playback with range support, metadata/tags, used/unused filters and linked posts. Upload limit is 20 MB. Seed media are labeled metadata examples.
- Assistant: persistent conversations, writing-profile/context retrieval, structured tools that read actual workspace records, and approval-gated write actions. Mock mode supports explicit `Create idea: ...` and `Create post: ...` commands plus the tool composer; unrestricted natural-language reasoning requires Groq.
- Voice: upload, mock or Groq transcription, editable saved transcript, suggested content ideas, select ideas to save or turn into drafts.
- Intelligence: read-only Notion sync or sample data, searchable/filterable records, provenance, source metadata, interpretable relevance reasons, dismissals and content opportunities.
- Morning Review: manual sync-and-review, KEEP/MINOR UPDATE/MAJOR UPDATE/REPLACE recommendations, supporting evidence, additional-post suggestions and persistent decision history. Revisions change a draft only after approval, and stale originals prevent accidental overwrites. Identical review inputs reuse a review; changed inputs produce new history.
- Settings: complete writing profile, editable topics, provider status and usage by request/model with optional estimated costs. Global search covers posts, variants, ideas, intelligence, media and trends.

The seeded policy/research examples demonstrate unchanged, minor-update and major-update posts plus a new-post opportunity. All sample intelligence and simulated metrics are labeled. They are demonstrations, not current news or actual social performance.

## Configuration

Copy values into `.env.local` and restart the server. Never commit credentials.

| Variables                          | Purpose                                                                                                               |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `LOCAL_DEV_MODE`, `LOCAL_DATA_DIR` | Local owner bypass and optional persistent-data location                                                              |
| `APP_TIMEZONE`                     | IANA timezone, default `America/New_York`; used for calendar and daily review                                         |
| `GROQ_API_KEY`, `AI_PRIMARY_MODEL` | Enable real Groq chat, drafting, ideation and editorial analysis; choose a model available in your Groq account       |
| `AI_FAST_MODEL`                    | Optional model for low-cost shortening and requests marked fast; primary is the fallback                              |
| `AI_TRANSCRIPTION_MODEL`           | Groq speech model; missing key or model uses explicitly labeled mock transcription                                    |
| `AI_MODEL_PRICING_JSON`            | Optional per-million-token rates, e.g. `{"your-model":{"input":0.1,"output":0.2}}`; absent rates display unknown cost |
| `NOTION_API_KEY`                   | Enables live read-only Notion requests                                                                                |
| `NOTION_DAILY_BRIEF_DATABASE_ID`   | Database shared with the Notion integration; its data sources are queried                                             |
| `NOTION_DAILY_BRIEF_PAGE_ID`       | Alternative page shared with the integration; imports the page and direct child pages                                 |
| `NOTION_PROPERTY_MAPPING_JSON`     | Overrides default property names, e.g. `{"title":"Title","publishedAt":"Published","sourceUrl":"Source URL"}`         |
| `DAILY_INTELLIGENCE_REVIEW_TIME`   | Default `07:00`; scheduler helper supports this threshold, but no background scheduler is installed                   |

Notion defaults: Name, Category, Summary, URL, Source, Author, Date, Companies, Jurisdiction, Topics, Tags, Institution, Journal, Abstract, Bill, Agency, Status, Important dates. Configure a database or page ID when enabling Notion. Integration permissions must include reading the selected content. The database takes precedence when both IDs are set. The app never writes back to Notion.

Production/auth, Gemini, R2, social and Telegram environment placeholders remain in `.env.example`. They do not enable those integrations. Analytics and trend collection are still mocked. Media understanding remains manual/mock.

## Architecture and database

Next.js App Router, React, strict TypeScript, Tailwind, Drizzle and persistent PGlite PostgreSQL. Database/provider access stays server-side. The Neon and Auth.js foundation is retained for a later production stage.

| Location                                       | Responsibility                                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| `app/manage-actions.ts`                        | Authenticated, validated UI mutations and voice upload                            |
| `components/manage/`                           | Calendar, editor, libraries, review, assistant, settings and search               |
| `services/content.ts`                          | Content CRUD, conversion, scheduling and attachments                              |
| `services/ai.ts`, `services/assistant.ts`      | Profile/context retrieval, usage, suggestions, bounded tool loop and approvals    |
| `services/intelligence.ts`, `services/jobs.ts` | Sync, scoring, evidence-based review, decisions and scheduler-neutral entry point |
| `providers/`                                   | Independent contracts, server-only selection, Groq/Notion adapters and mocks      |
| `prompts/`                                     | Identity, writing profile and task-specific prompt modules                        |
| `db/`, `drizzle/`                              | Schema, seeds and ordered migrations                                              |

35 tables retain the original 29-table foundation and add AI suggestions, opportunities, intelligence/post relations, transcripts, assistant tool calls and sync runs. Stage 2 expands post concept fields, writing preferences, intelligence provenance/classification and usage cost fields. Publication dates may be unknown. Review input hashes replace date-only uniqueness so multiple revisions of a day's review remain available. SQL migrations `0001` and `0002` upgrade existing data without replacing it.

Groq uses environment-selected models, structured tool calls and JSON responses, with token accounting and request timeouts. Assistant writes are queued, then executed transactionally after approval; no publish tool exists. Retrieved content is treated as untrusted data. Notion ingestion maps rich properties, paginates data sources/blocks, retries rate limits and transient failures, flattens nested text, and upserts by source/external ID. It preserves dismissals and avoids duplicate opportunities. Crawl limits fail explicitly instead of silently importing incomplete pages. See `providers/README.md` for adapter details.

## Validation

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
# Stop normal dev first: Next development uses a shared build lock.
npm.cmd run test:e2e
```

Unit/integration tests cover PostgreSQL CRUD, variants, timezone scheduling, attachments, approval/stale-original handling, idempotent sync/reviews, scoring, assistant tools/conversations, local auth boundaries, and mocked Groq/Notion HTTP contracts. The Edge Playwright workflow uses an isolated temporary local database on port 3100 and empty external API keys. It exercises the major screens, editing/scheduling, AI approvals, media, Notion mock sync, review decisions, assistant tools, voice, settings, search and mobile navigation. Microsoft Edge must be installed.

Browser screenshots are generated under `.local/stage2-{calendar,editor,review,assistant,mobile}.png`: week calendar, variant comparison/editor, evidence-based morning review, assistant/voice workflow and mobile dashboard. These are local verification artifacts, not committed fixtures.

Database utilities: `npm.cmd run db:seed` also applies migrations, `npm.cmd run db:generate` generates SQL, and `npm.cmd run db:migrate:production` targets the configured Neon scaffold. Do not run production migration commands without configuring that database deliberately.

## Remaining boundaries

Real Groq/Notion account behavior requires your credentials and model/database configuration; automated adapter tests use mocked HTTP. No real X/LinkedIn publishing, social metrics ingestion, Gemini analysis, R2 storage, Telegram, public deployment or unattended daily scheduler is included. Morning Review runs from the UI; a future authenticated scheduler can call `dailyWorkflow`. AI output remains a draft for human review. Pricing is user-supplied and estimates cover token usage, not provider billing reconciliation.
