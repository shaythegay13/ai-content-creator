# Roadmap

Fieldnotes already runs as a local workspace: ideas, X and LinkedIn drafts, a calendar, media files, a mock or Groq assistant, read-only Notion or sample intelligence, and a manual Morning Review. This plan is the remaining work that turns that workspace into a finished single-user product. Each item names the code that is missing or only scaffolded. It does not add platforms, channels, or providers the repository does not already point at.

Do the priorities in order. Later work depends on the local app staying honest about sample data.

## P0 — Make the local app match its own boundaries

1. **Add CI.** There is no `.github` workflow. Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` on Node 22. Keep Playwright as a separate job once item 2 is done.
2. **Let end-to-end tests run without Microsoft Edge.** `playwright.config.ts` sets `channel: 'msedge'`. Use the Playwright Chromium (or the installed Chrome) by default, and keep Edge as an explicit override. The existing spec in `tests/e2e/workspace.spec.ts` already walks the main screens, a generated draft, scheduling, approvals, media, mock Notion, review decisions, the assistant, voice, settings, search, and a narrow viewport.
3. **Leave the ESLint transitive advisory alone until upstream moves.** `npm audit` still reports `braces` through `micromatch` → `fast-glob` → `@next/eslint-plugin-next` → `eslint-config-next`. `npm audit fix --force` would install `eslint-config-next@14`, which drops the Next 16 config. Next itself is pinned to the 16.3 line (`~16.3.8`) so the 16.3.0–16.3.7 advisories are not in a fresh install.
4. **Point Analytics at the same UI kit as the other sections, and show only stored metrics.** `/analytics` still renders `WorkspacePage` in `components/workspace-views.tsx`. The home “Content at a glance” chart is the literal height list `[25, 38, 31, 55, 44, 70, 58, 88, 72, 100, 83, 95]`. Replace that decoration with counts from `post_metric_snapshots`, and keep the existing “sample data” notice until P3 writes non-simulated rows.
5. **Update the shell copy that still says “Stage 2”.** `components/shell.tsx` footer. The schema has since added the content-brain tables in migration `0004`.
6. **Read the signed-in user in the shell.** The sidebar and avatar letter are the literals `Shay` and `S`. The seed inserts that same user. A finished local app should render `requireUser()` so the chrome and the database row cannot drift.

## P1 — Run the editorial day the services already describe

1. **Call `isReviewDue`.** `services/jobs.ts` compares the current time in `APP_TIMEZONE` with `DAILY_INTELLIGENCE_REVIEW_TIME`. Nothing imports it. Settings only prints the variable and the words “manual trigger active”.
2. **Add one local scheduler process.** It should call `dailyWorkflow` at most once per review date, reuse the existing review hash so an unchanged day does not create a second review, and record failures on `sync_runs` (the Intelligence screen already shows the latest sync status). It has to use the same `LOCAL_DATA_DIR` as the app and must not start a second PGlite writer. Do not deploy this to Vercel while `providers()` refuses non-local mode.
3. **Persist the Groq reservation ledger.** `providers/groq.ts` stores `ModelBudget` on `globalThis`. A restart clears the 30/minute, 1,000/day, 8,000 tokens/minute, and 200,000 tokens/day counters, so the next process can burst the real Groq account. Store the reservations in `app_settings` (or a small table) keyed by model, and keep Groq’s own errors as the backstop.
4. **Make the first-run profiles obvious on Home.** Settings already warns when About me, About my company, or Social strategy is empty, and generation still runs from the note alone. Home does not. Link the empty profile kinds from the dashboard so a new clone is not drafting with an empty brain by accident.

## P2 — Publish only after a real network call succeeds

The editor copy is accurate today: “Publishing is off. Scheduling organizes your calendar. Nothing is sent to X or LinkedIn.” `services/content.ts` throws `Publishing is disabled.` when a post or variant status is `published`. `MockSocialPublisher` can return a fake external id, and `providers()` constructs it, but no service calls `publisher.publish`.

1. **Add X and LinkedIn adapters behind `SocialPublisher`.** The env names `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`, `LINKEDIN_CLIENT_ID`, and `LINKEDIN_CLIENT_SECRET` are not read anywhere in `*.ts`. Follow the Notion pattern: a small HTTP adapter, contract tests with a mocked `fetch`, and no silent fallback to the mock when credentials are present and the request fails.
2. **Gate the status change on that result.** A variant becomes `published` only after the adapter returns an external id. Write `published_posts` with `simulated: false`, the id, and the URL. Keep the approval check the mock already requires. Leave the mock in place for local runs with empty credentials, and keep the on-screen “simulated” label whenever `simulated` is true.
3. **Reject partial success per platform.** X and LinkedIn are already separate variant rows. A failure on one platform must not mark the other published and must not delete the draft.

## P3 — Replace sample performance and sample trends with ingested rows

1. **Call `SocialAnalyticsProvider`.** `MockSocialAnalyticsProvider.metrics` returns the fixed counts 8420 / 146 / 28 and has no caller. Seeded `post_metric_snapshots` supply Analytics and the home impression total. After P2, a sync should append a snapshot for each non-simulated `published_posts` row. Keep simulated seed rows labeled, and do not overwrite them with mock constants.
2. **Let the content brain see real posts only.** `services/content-context.ts` already ignores `published_posts.simulated = true` and requires five genuine posts on the same platform, each with at least 100 impressions, before it will describe a wording pattern. That branch stays empty until P3 has data. Add a fixture test that five qualifying snapshots produce a pattern and four do not, so the threshold cannot quietly drop.
3. **Refresh `trend_items`.** `MockTrendSource.fetch` runs during the first seed and then never again. The Trends page reads those rows and says no monitoring is active. Add a server action, next to intelligence sync, that upserts on `(source, externalId)` and records a `sync_runs` row. The repository does not name a trend vendor. Ship the action against the existing `TrendSource` interface first; add a live source only when one is chosen and given its own env names. Until then, keep the sample notice.
4. **Delete the decorative bar chart** once snapshots can be plotted, or earlier under P0.4 if the plot is still sample-only.

## P4 — Turn on the hosted path that is already sketched

`db/client.ts` can open Neon when local mode is off and `DATABASE_URL` is set. `auth.ts` allows Google sign-in only for a verified `OWNER_EMAIL`. `AuthJsAuthenticationProvider` then loads that email from `users`. `providers()` still throws before any of that can serve a page, and local mode is forbidden when `VERCEL` is set.

1. **Split provider selection from the local-only guard.** Local mode keeps today’s mocks. Hosted mode should require `DATABASE_URL`, `AUTH_SECRET`, Google credentials, `OWNER_EMAIL`, and a `users` row for that email (the seed email `owner@localhost.test` must not be the hosted owner). Missing Groq or Notion keys should keep those two adapters on their labeled mocks; a configured key that then fails must still surface the error.
2. **Implement `MediaStorageProvider` for the R2 env names, or remove the names.** `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_BUCKET`, and `CLOUDFLARE_R2_PUBLIC_URL` are unread. Local disk is the only `put` / `get` / `delete`. Hosted mode cannot share `.local/media` across instances. `app/api/media/[id]/route.ts` already streams bytes and range requests; keep that route and swap the storage backend.
3. **Apply `npm run db:migrate:production` to an empty Neon database** and confirm the app boots with an owner login and zero sample ideas. The production migrator already skips the seed. Add a smoke test that `seed` is not called on that path.
4. **Serve the scheduler from the host** only after P1’s once-per-day behavior is tested locally. The scheduler needs the same auth boundary as the UI: it may run as the owner, and it must not be a public URL.

## P5 — Either implement the remaining adapters or stop listing them

These names are in `.env.example` and are not referenced by application code:

- `GEMINI_API_KEY`, `MEDIA_UNDERSTANDING_MODEL` — `MockMediaUnderstandingProvider.analyze` returns a fixed placeholder and is never called from upload or the media library.
- `TELEGRAM_BOT_TOKEN` — `MockChatChannel.receive` returns `[]` and `send` returns `{ simulated: true }`. No route calls it.

For a finished product, wire media analysis into the upload action behind `MediaUnderstandingProvider`, and wire a chat channel behind `ChatChannel`, with the same “configured credentials do not fall back to a fake success” rule as Groq. If either integration is dropped, delete the unused env names and the unused mock class so setup no longer implies it exists.

## P6 — Tighten retrieval with tests already possible from fixtures

`ContentContextService` ranks with the lexical helpers `terms` and `relevance` in `services/content-context.ts`. Notion section text can be long; a paraphrase of a heading will not match. Before changing the ranker, add fixtures from the current sample brief and the seeded posts that lock today’s relevant and irrelevant picks. Any later ranker has to pass that file. No embedding provider is configured in this repository; do not add one as part of unrelated publishing work.

## Done means

- A clean machine follows the README and gets the seeded workspace without a key.
- CI is green on typecheck, lint, unit tests, and build.
- End-to-end tests run on stock Chromium.
- Morning Review can run from the button and from the local scheduler, once per day.
- With X and LinkedIn credentials, an approved variant is published per platform, stored as non-simulated, and later receives metric snapshots.
- With those credentials absent, the UI still says publishing is simulated and no status flips to `published`.
- Analytics and Trends no longer show hardcoded or one-time seed rows as if they were live.
- Hosted mode uses Neon, the Google owner login, and shared media storage, and refuses local-mode bypass.
