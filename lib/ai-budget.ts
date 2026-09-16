import type { AIMessageInput, AIRequest } from '../providers/contracts';

// Conservative heuristic, not a tokenizer. Provider accounting is authoritative.
export const estimateTokens = (value: unknown) =>
  Math.ceil(Buffer.byteLength(JSON.stringify(value), 'utf8') / 3) + 64;
export const excerpt = (text: string | null | undefined, limit: number) =>
  text && text.length > limit
    ? `${text.slice(0, limit)} [excerpt]`
    : text || '';

export function relevantExcerpt(
  text: string | null | undefined,
  query: string,
  limit: number,
) {
  if (!text || text.length <= limit) return text || '';
  const words = [...new Set(query.toLowerCase().match(/[a-z]{5,}/g) || [])];
  const lines = text
    .split('\n')
    .map((line, index) => ({
      line,
      index,
      score: words.filter((w) => line.toLowerCase().includes(w)).length,
    }));
  const best = [...lines].sort((a, b) => b.score - a.score)[0];
  if (!best?.score) return excerpt(text, limit);
  return excerpt(
    lines
      .slice(best.index)
      .map((v) => v.line)
      .join('\n'),
    limit,
  );
}
export function compactData(value: unknown, stringLimit = 700): unknown {
  if (typeof value === 'string') return excerpt(value, stringLimit);
  if (Array.isArray(value))
    return value.slice(0, 4).map((v) => compactData(v, stringLimit));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !['rawText', 'metadata', 'evidenceSnapshot', 'context'].includes(
              key,
            ),
        )
        .map(([key, v]) => [key, compactData(v, stringLimit)]),
    );
  return value;
}

// Keep complete recent conversational messages; never cut tool IDs or JSON arguments.
export function boundedHistory(messages: AIMessageInput[], budget = 1400) {
  const selected: AIMessageInput[] = [];
  let used = 0;
  for (const message of [...messages].reverse()) {
    const cost = estimateTokens(message);
    if (used + cost > budget) break;
    selected.unshift(message);
    used += cost;
  }
  if (!selected.length && messages.length)
    throw new Error(
      'This message is too long for the configured AI budget. Split it into smaller requests.',
    );
  return selected;
}

export type Limits = { rpm: number; rpd: number; tpm: number; tpd: number };
export class ModelBudget {
  private entries: { at: number; tokens: number }[] = [];
  constructor(private now: () => number = Date.now) {}
  reserve(tokens: number, limits: Limits) {
    const now = this.now();
    this.entries = this.entries.filter((e) => now - e.at < 86400000);
    if (tokens > limits.tpm)
      throw new Error(
        'AI request exceeds the per-minute token budget. Reduce the input.',
      );
    if (
      this.entries.length >= limits.rpd ||
      this.entries.reduce((n, e) => n + e.tokens, 0) + tokens > limits.tpd
    )
      throw new Error(
        'Local daily AI budget reached for this model. Try again after the rolling daily window resets.',
      );
    const minute = this.entries.filter((e) => now - e.at < 60000);
    if (
      minute.length >= limits.rpm ||
      minute.reduce((n, e) => n + e.tokens, 0) + tokens > limits.tpm
    )
      return { waitMs: Math.max(1, 60001 - (now - minute[0].at)) };
    const entry = { at: now, tokens };
    this.entries.push(entry);
    return {
      waitMs: 0,
      settle: (actual: number) => {
        entry.tokens = Math.max(0, actual);
      },
    };
  }
}

export function requestBudget(input: AIRequest) {
  const output = input.maxOutputTokens ?? (input.tier === 'fast' ? 600 : 1200);
  if (!Number.isInteger(output) || output < 1 || output > 2400)
    throw new Error('Invalid AI output budget.');
  const tokens =
    estimateTokens({ messages: input.messages, tools: input.tools }) + output;
  if (tokens > 6000)
    throw new Error(
      'This AI request exceeds the 6,000-token workflow envelope. Shorten the draft, notes or conversation. Nothing was sent to Groq.',
    );
  return { tokens, output };
}
