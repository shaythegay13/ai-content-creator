import { beforeAll, afterAll, beforeEach, it, expect, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import * as s from '../db/schema';
import { seed } from '../db/seed';
import { DEV_USER_ID, MockAIProvider } from '../providers/mocks';
import type { AIProvider, AIRequest } from '../providers/contracts';
import { AIOutputError } from '../providers/contracts';
import {
  saveIdea,
  convertIdea,
  savePost,
  saveVariant,
  scheduleVariant,
} from '../services/content';
import {
  draftPlatform,
  generateVariant,
} from '../services/platform-generation';
import {
  saveGenerationSettings,
  defaultGenerationSettings,
} from '../services/generation-settings';
import {
  validatePlatform,
  composePost,
  hashtagsIn,
} from '../lib/platform-validation';
const client = new PGlite();
const db = drizzle(client, { schema: s });
const mock = new MockAIProvider();
beforeAll(async () => {
  await migrate(db, { migrationsFolder: 'drizzle' });
  await seed(db);
});
afterAll(() => client.close());
beforeEach(async () => {
  await saveGenerationSettings(db, defaultGenerationSettings);
});
const variants = (id: string) =>
  db
    .select()
    .from(s.contentPostVariants)
    .where(eq(s.contentPostVariants.postId, id));
async function idea() {
  return saveIdea(db, DEV_USER_ID, {
    title: 'Retention beyond the first trade',
    rawNote:
      'Prediction market teams should measure whether users return after their first trade. Signup growth alone does not demonstrate a lasting habit.',
  });
}
const response = (
  body: string,
  platform = 'x',
  hashtags = ['PredictionMarkets'],
) => ({
  text: JSON.stringify({ platform, body, hashtags }),
  model: 'test',
  inputTokens: 10,
  outputTokens: 20,
});
function provider(
  complete: (request: AIRequest) => Promise<ReturnType<typeof response>>,
): AIProvider {
  return {
    name: 'test',
    complete: async (request) => {
      const task = JSON.parse(request.messages.at(-1)!.content!).task;
      return task === 'platform-draft'
        ? complete(request)
        : mock.complete(request);
    },
    generate: async () => response('Unused'),
  };
}
it('idea conversion automatically creates valid X and LinkedIn drafts with independently stored hashtags', async () => {
  const original = await idea();
  const post = await convertIdea(
    db,
    DEV_USER_ID,
    original.id,
    ['x', 'linkedin'],
    mock,
  );
  const rows = await variants(post.id);
  expect(rows).toHaveLength(2);
  for (const row of rows) {
    expect(row.generationStatus).toBe('succeeded');
    expect(row.status).toBe('draft');
    expect(validatePlatform(row.platform, row.body).valid).toBe(true);
    expect(row.hashtags).toEqual(hashtagsIn(row.body));
    expect(row.hashtags.length).toBeGreaterThanOrEqual(
      row.platform === 'x' ? 1 : 3,
    );
  }
  expect(
    (
      await db
        .select()
        .from(s.contentIdeas)
        .where(eq(s.contentIdeas.id, original.id))
    )[0].rawNote,
  ).toBe(original.rawNote);
});
it('generates only explicitly selected platforms', async () => {
  const original = await idea();
  const post = await convertIdea(db, DEV_USER_ID, original.id, ['x'], mock);
  expect((await variants(post.id)).map((v) => v.platform)).toEqual(['x']);
});
it('counts weighted Unicode, emoji clusters and shortened URLs instead of JS length', () => {
  expect(validatePlatform('x', '界'.repeat(140)).count).toBe(280);
  expect(validatePlatform('x', '界'.repeat(141)).valid).toBe(false);
  expect(validatePlatform('x', '👨‍👩‍👧‍👦').count).toBe(2);
  expect(
    validatePlatform('x', 'https://example.com/' + 'path'.repeat(100)).count,
  ).toBe(23);
  expect(validatePlatform('x', 'a'.repeat(280)).valid).toBe(true);
  expect(
    validatePlatform('x', composePost('a'.repeat(270), ['PredictionMarkets']))
      .valid,
  ).toBe(false);
});
it('compresses over-limit output and validates the complete hashtag-bearing result', async () => {
  const complete = vi
    .fn()
    .mockResolvedValueOnce(response('界'.repeat(180)))
    .mockResolvedValueOnce(response('Retention starts after the first trade.'));
  const draft = await draftPlatform(
    db,
    provider(complete),
    'x',
    'Prediction market retention',
  );
  expect(complete).toHaveBeenCalledTimes(2);
  expect(complete.mock.calls[1][0].tier).toBe('fast');
  expect(draft.body).toContain('#PredictionMarkets');
  expect(validatePlatform('x', draft.body).valid).toBe(true);
  expect(
    JSON.parse(complete.mock.calls[1][0].messages[1].content).correction,
  ).toContain('weighted');
});
it('recovers from provider JSON-validation rejection within the same bounded retry loop', async () => {
  const complete = vi
    .fn()
    .mockRejectedValueOnce(
      new AIOutputError('Groq could not produce valid structured JSON.'),
    )
    .mockResolvedValueOnce(
      response('Measure retention beyond the first trade.'),
    );
  const draft = await draftPlatform(
    db,
    provider(complete),
    'x',
    'Prediction market retention',
  );
  expect(complete).toHaveBeenCalledTimes(2);
  expect(validatePlatform('x', draft.body).valid).toBe(true);
});
it('repairs an unrelated AI hashtag instead of borrowing it from the writing profile', async () => {
  const complete = vi
    .fn()
    .mockResolvedValueOnce(
      response('Measure retention beyond the first trade.', 'x', ['AI']),
    )
    .mockResolvedValueOnce(
      response('Measure retention beyond the first trade.'),
    );
  const draft = await draftPlatform(
    db,
    provider(complete),
    'x',
    'Prediction market retention',
  );
  expect(draft.hashtags).toEqual(['PredictionMarkets']);
  expect(complete).toHaveBeenCalledTimes(2);
});
it('persists a per-platform failure without saving invalid text, then retries without duplicates', async () => {
  const original = await idea();
  const complete = vi.fn(async (request: AIRequest) => {
    const data = JSON.parse(request.messages.at(-1)!.content!);
    return data.platform === 'x'
      ? response('x'.repeat(400))
      : response('Measure repeat behavior, not just signups.', 'linkedin', [
          'PredictionMarkets',
          'ProductStrategy',
          'CustomerRetention',
        ]);
  });
  const post = await convertIdea(
    db,
    DEV_USER_ID,
    original.id,
    ['x', 'linkedin'],
    provider(complete),
  );
  let rows = await variants(post.id);
  expect(rows.find((v) => v.platform === 'x')?.generationStatus).toBe('failed');
  expect(rows.find((v) => v.platform === 'x')?.body).toBe('');
  expect(rows.find((v) => v.platform === 'x')?.generationError).toContain(
    '3 attempts',
  );
  expect(rows.find((v) => v.platform === 'linkedin')?.generationStatus).toBe(
    'succeeded',
  );
  const failedId = rows.find((v) => v.platform === 'x')!.id;
  await generateVariant(db, mock, post.id, 'x');
  await generateVariant(db, mock, post.id, 'x');
  rows = await variants(post.id);
  expect(rows).toHaveLength(2);
  expect(rows.find((v) => v.platform === 'x')?.id).toBe(failedId);
  expect(rows.find((v) => v.platform === 'x')?.generationStatus).toBe(
    'succeeded',
  );
});
it('network failures leave the original idea and post available for retry', async () => {
  const original = await idea();
  const post = await convertIdea(
    db,
    DEV_USER_ID,
    original.id,
    ['x'],
    provider(async () => {
      throw new Error('Service unavailable');
    }),
  );
  const [row] = await variants(post.id);
  expect(row.generationError).toContain('Service unavailable');
  expect(post.coreIdea).toBe(original.rawNote);
});
it('disabling automatic generation creates blank variants and makes zero model calls', async () => {
  await saveGenerationSettings(db, {
    ...defaultGenerationSettings,
    autoGenerate: false,
  });
  const complete = vi.fn();
  const original = await idea();
  const post = await convertIdea(
    db,
    DEV_USER_ID,
    original.id,
    ['x', 'linkedin'],
    provider(complete),
  );
  expect(complete).not.toHaveBeenCalled();
  expect(
    (await variants(post.id)).every(
      (v) => v.body === '' && v.generationStatus === 'idle',
    ),
  ).toBe(true);
  await generateVariant(db, mock, post.id, 'x');
  expect(
    (await variants(post.id)).find((v) => v.platform === 'x')?.generationStatus,
  ).toBe('succeeded');
});
it.each(['x', 'linkedin'] as const)(
  'regenerating %s preserves both current variants and proposes only the selected replacement',
  async (platform) => {
    const original = await idea();
    const post = await convertIdea(
      db,
      DEV_USER_ID,
      original.id,
      ['x', 'linkedin'],
      mock,
    );
    const before = await variants(post.id);
    await generateVariant(db, mock, post.id, platform, true);
    const after = await variants(post.id);
    expect(after.map((v) => [v.id, v.body]).sort()).toEqual(
      before.map((v) => [v.id, v.body]).sort(),
    );
    const chosen = before.find((v) => v.platform === platform)!;
    const proposed = await db
      .select()
      .from(s.suggestions)
      .where(eq(s.suggestions.variantId, chosen.id));
    expect(proposed).toHaveLength(1);
    expect(proposed[0].original).toBe(chosen.body);
    expect(proposed[0].state).toBe('pending');
    expect(validatePlatform(platform, proposed[0].suggested).valid).toBe(true);
    const other = before.find((v) => v.platform !== platform)!;
    expect(
      await db
        .select()
        .from(s.suggestions)
        .where(eq(s.suggestions.variantId, other.id)),
    ).toHaveLength(0);
  },
);
it('settings control hashtags and both platform prompts include the writing profile', async () => {
  await saveGenerationSettings(db, {
    ...defaultGenerationSettings,
    x: { enabled: false, min: 1, max: 2 },
    linkedin: { enabled: true, min: 4, max: 4 },
  });
  expect(
    (await draftPlatform(db, mock, 'x', 'Prediction market retention'))
      .hashtags,
  ).toHaveLength(0);
  expect(
    (await draftPlatform(db, mock, 'linkedin', 'Prediction market retention'))
      .hashtags,
  ).toHaveLength(4);
  const complete = vi
    .fn<(request: AIRequest) => Promise<ReturnType<typeof response>>>()
    .mockResolvedValue(response('A useful question.', 'x', []));
  await draftPlatform(db, provider(complete), 'x', 'Founder lessons');
  const prompt = complete.mock.calls[0][0].messages[0].content;
  expect(prompt).toContain('Writing preferences');
  expect(prompt).toContain('HARD LIMIT');
});
it('server save and scheduling reject over-limit X text, including legacy rows', async () => {
  const post = await savePost(db, DEV_USER_ID, { title: 'Validation test' });
  await expect(
    saveVariant(db, { postId: post.id, platform: 'x', body: 'x'.repeat(281) }),
  ).rejects.toThrow('280');
  const [legacy] = await db
    .insert(s.contentPostVariants)
    .values({ postId: post.id, platform: 'x', body: '界'.repeat(200) })
    .returning();
  await expect(
    scheduleVariant(db, {
      variantId: legacy.id,
      localTime: '2026-10-01T12:00',
      timezone: 'America/New_York',
    }),
  ).rejects.toThrow('280');
  expect((await variants(post.id))[0].body).toBe(legacy.body);
});
it('concurrent retries share one variant and one in-flight model call', async () => {
  const post = await savePost(db, DEV_USER_ID, {
    title: 'Concurrency',
    coreIdea: 'Prediction market retention',
  });
  const complete = vi.fn(async () => {
    await new Promise((r) => setTimeout(r, 30));
    return response('A useful retention question.');
  });
  const ai = provider(complete);
  await Promise.all([
    generateVariant(db, ai, post.id, 'x'),
    generateVariant(db, ai, post.id, 'x'),
  ]);
  expect(await variants(post.id)).toHaveLength(1);
  expect(complete).toHaveBeenCalledTimes(1);
});
