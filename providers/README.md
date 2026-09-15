# Provider boundaries

Contracts are independent of React and vendor SDKs. `index.ts` is the server-only composition root, currently enabled only in local mode.

| Capability                                                        | Selection                                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| AI                                                                | Groq when `GROQ_API_KEY` exists, otherwise deterministic mock       |
| Speech                                                            | Groq when key and transcription model exist, otherwise labeled mock |
| Intelligence                                                      | Read-only Notion when its key exists, otherwise sample records      |
| Storage                                                           | Local filesystem, authenticated media delivery                      |
| Media understanding, analytics, trends, chat channels, publishing | Mock/scaffold only                                                  |

`groq.ts` implements chat-completions messages, optional JSON mode, structured tool calls, primary/fast model routing and token usage. Speech uses multipart upload. Models come from environment variables; no retired model identifier is hardcoded. Provider errors and timeouts surface to the user; configured real providers do not silently fabricate a successful mock response on failure.

`notion.ts` uses API version 2025-09-03, retrieves database data sources and queries their pages, or ingests a configured page and its direct child pages. It paginates and recursively reads block text with explicit depth/page limits, retries transient failures, maps rich properties through configurable names, and preserves provenance and unknown dates. HTTP writes to content are absent; the only POST queries a data source. Persistence, deduplication, relevance and opportunities belong in `services/intelligence.ts`.

Generation usage and optional token-price estimates are recorded in `services/ai.ts`; transcription usage is recorded by the upload action. Assistant tools read the workspace or enqueue an approval, and write execution is idempotent. Editorial and rewrite suggestions preserve the original until explicitly accepted.

Neon/Auth.js, Gemini, R2, X, LinkedIn and Telegram production integrations remain future work. Live credential verification is separate from the mocked HTTP contract tests in `tests/stage2.test.ts`.
