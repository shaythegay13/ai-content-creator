import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import * as s from '../db/schema';
import { seed } from '../db/seed';
import { seedStage2 } from '../db/seed-stage2';
import {
  savePost,
  saveIdea,
  saveVariant,
  scheduleVariant,
  duplicatePost,
  convertIdea,
  attachMedia,
  archiveOrDelete,
} from '../services/content';
import {
  DEV_USER_ID,
  MockAIProvider,
  MockIntelligenceSourceProvider,
  MockTranscriptionProvider,
} from '../providers/mocks';
import {
  syncIntelligenceItems,
  runEditorialReview,
  decideReview,
  scoreItem,
  reviewOne,
} from '../services/intelligence';
import {
  assistantChat,
  approveTool,
  executeTool,
  queueTool,
  assistantTools,
} from '../services/assistant';
import { suggest, retrieveContext } from '../services/ai';
import { requestBudget } from '../lib/ai-budget';
import { GroqAIProvider, GroqTranscriptionProvider } from '../providers/groq';
import {
  parseNotionPage,
  NotionIntelligenceProvider,
} from '../providers/notion';
import { localDateTime, zonedInput } from '../lib/time';
const client = new PGlite();
const db = drizzle(client, { schema: s });
it('ordinary assistant retrieval plus all tool schemas fits the request envelope', async () => {
  const context = await retrieveContext(db, 'Prediction market retention');
  expect(() =>
    requestBudget({
      messages: [
        { role: 'system', content: context },
        {
          role: 'user',
          content: 'Suggest two angles about prediction market retention.',
        },
      ],
      tools: assistantTools,
    }),
  ).not.toThrow();
});
const ai = new MockAIProvider();
beforeAll(async () => {
  await migrate(db, { migrationsFolder: 'drizzle' });
  await seed(db);
  await seedStage2(db);
});
afterAll(() => client.close());
it('edits concepts, preserves variants and duplicates without scheduling', async () => {
  const p = await savePost(db, DEV_USER_ID, {
    title: 'Working concept',
    coreIdea: 'Original thought',
    pillar: 'AI',
  });
  const v = await saveVariant(db, {
    postId: p.id,
    platform: 'x',
    body: 'Keep\nparagraphs',
  });
  await saveVariant(db, { ...v, body: 'Edited\nparagraphs' });
  await savePost(db, DEV_USER_ID, { ...p, notes: 'Source check' });
  const copy = await duplicatePost(db, DEV_USER_ID, p.id);
  const variants = await db
    .select()
    .from(s.contentPostVariants)
    .where(eq(s.contentPostVariants.postId, copy.id));
  expect(variants[0].body).toBe('Edited\nparagraphs');
  expect(variants[0].status).toBe('draft');
  await archiveOrDelete(db, copy.id, 'delete');
  expect(
    await db
      .select()
      .from(s.contentPostVariants)
      .where(eq(s.contentPostVariants.postId, copy.id)),
  ).toHaveLength(0);
});
it('calendar create/reschedule/archive respects timezone', async () => {
  const p = await savePost(db, DEV_USER_ID, { title: 'Calendar test' });
  const v = await saveVariant(db, {
    postId: p.id,
    platform: 'linkedin',
    body: 'A useful story',
  });
  await scheduleVariant(db, {
    variantId: v.id,
    localTime: '2026-10-12T10:30',
    timezone: 'America/New_York',
  });
  await scheduleVariant(db, {
    variantId: v.id,
    localTime: '2026-10-13T11:45',
    timezone: 'America/New_York',
  });
  const entries = await db
    .select()
    .from(s.contentCalendarEntries)
    .where(eq(s.contentCalendarEntries.variantId, v.id));
  expect(entries).toHaveLength(1);
  expect(entries[0].scheduledAt.toISOString()).toBe('2026-10-13T15:45:00.000Z');
  await archiveOrDelete(db, p.id, 'archive');
  expect(
    await db
      .select()
      .from(s.contentCalendarEntries)
      .where(eq(s.contentCalendarEntries.variantId, v.id)),
  ).toHaveLength(0);
});
it('rejects nonexistent daylight-saving local times', () => {
  expect(() => localDateTime('2026-03-08T02:30', 'America/New_York')).toThrow();
  expect(
    zonedInput(
      localDateTime('2026-11-01T01:30', 'America/New_York'),
      'America/New_York',
    ),
  ).toBe('2026-11-01T01:30');
});
it('ideas convert to posts with media and preserve notes', async () => {
  const [media] = await db.select().from(s.mediaAssets);
  const i = await saveIdea(db, DEV_USER_ID, {
    title: 'Voice lesson',
    rawNote: 'Keep the useful detail',
    mediaIds: [media.id],
    source: 'voice',
  });
  await saveIdea(db, DEV_USER_ID, {
    ...i,
    rawNote: 'Edited detail',
    mediaIds: [media.id],
  });
  const p = await convertIdea(db, DEV_USER_ID, i.id);
  expect(p.coreIdea).toBe('Edited detail');
  expect(
    await db
      .select()
      .from(s.mediaPostRelations)
      .where(eq(s.mediaPostRelations.postId, p.id)),
  ).toHaveLength(1);
  await attachMedia(db, p.id, []);
  const [asset] = await db
    .select()
    .from(s.mediaAssets)
    .where(eq(s.mediaAssets.id, media.id));
  expect(asset.usageStatus).toBe('unused');
});
it('sync updates existing items, preserves dismissals and creates opportunities', async () => {
  await syncIntelligenceItems(db, new MockIntelligenceSourceProvider());
  const count = (await db.select().from(s.intelligenceItems)).length;
  const [item] = await db.select().from(s.intelligenceItems);
  await db
    .update(s.intelligenceItems)
    .set({ dismissed: true })
    .where(eq(s.intelligenceItems.id, item.id));
  await syncIntelligenceItems(db, new MockIntelligenceSourceProvider());
  expect(await db.select().from(s.intelligenceItems)).toHaveLength(count);
  const [same] = await db
    .select()
    .from(s.intelligenceItems)
    .where(eq(s.intelligenceItems.id, item.id));
  expect(same.dismissed).toBe(true);
  expect((await db.select().from(s.opportunities)).length).toBeGreaterThan(0);
  await db.update(s.intelligenceItems).set({ dismissed: false });
});
it('review retains originals, links evidence, and applies only accepted revisions', async () => {
  const before = await db.select().from(s.contentPostVariants);
  const review = await runEditorialReview(db, ai, 'America/New_York');
  expect((await runEditorialReview(db, ai, 'America/New_York')).id).toBe(
    review.id,
  );
  const rows = await db
    .select()
    .from(s.dailyEditorialPostReviews)
    .where(eq(s.dailyEditorialPostReviews.reviewId, review.id));
  expect(rows.map((r) => r.recommendation)).toContain('MAJOR_UPDATE');
  expect(rows.map((r) => r.recommendation)).toContain('MINOR_UPDATE');
  expect(rows.map((r) => r.recommendation)).toContain('KEEP');
  expect(await db.select().from(s.contentPostVariants)).toEqual(before);
  const changed = rows.find((r) => r.suggestedRevision && r.variantId)!;
  expect(changed.evidenceSnapshot).toBeTruthy();
  await decideReview(db, DEV_USER_ID, {
    id: changed.id,
    decision: 'edited',
    editedText: 'User approved this precise revision.',
  });
  const [v] = await db
    .select()
    .from(s.contentPostVariants)
    .where(eq(s.contentPostVariants.id, changed.variantId!));
  expect(v.body).toBe('User approved this precise revision.');
  expect(changed.originalText).not.toBe(v.body);
  await expect(
    decideReview(db, DEV_USER_ID, { id: changed.id, decision: 'accepted' }),
  ).rejects.toThrow('changed');
});
it('rejected revisions leave text alone and history survives', async () => {
  const review = await runEditorialReview(db, ai, 'America/New_York');
  const rows = await db
    .select()
    .from(s.dailyEditorialPostReviews)
    .where(eq(s.dailyEditorialPostReviews.reviewId, review.id));
  const row = rows.find((r) => r.variantId)!;
  const [before] = await db
    .select()
    .from(s.contentPostVariants)
    .where(eq(s.contentPostVariants.id, row.variantId!));
  await decideReview(db, DEV_USER_ID, { id: row.id, decision: 'rejected' });
  const [after] = await db
    .select()
    .from(s.contentPostVariants)
    .where(eq(s.contentPostVariants.id, row.variantId!));
  expect(after.body).toBe(before.body);
  expect(
    (await db.select().from(s.dailyEditorialReviews)).length,
  ).toBeGreaterThan(1);
});
it('mock chat persists conversation and executes approved application tools exactly once', async () => {
  const r = await assistantChat(
    db,
    DEV_USER_ID,
    ai,
    'Create idea: A testable retention hypothesis',
  );
  const [call] = await db
    .select()
    .from(s.assistantToolCalls)
    .where(eq(s.assistantToolCalls.conversationId, r.conversationId));
  expect(call.status).toBe('pending');
  const result = await approveTool(db, DEV_USER_ID, ai, call.id, true);
  expect(result).toHaveProperty('title', 'A testable retention hypothesis');
  await expect(approveTool(db, DEV_USER_ID, ai, call.id, true)).rejects.toThrow(
    'already',
  );
  await assistantChat(
    db,
    DEV_USER_ID,
    ai,
    'Make the idea more practical',
    r.conversationId,
  );
  expect(
    (
      await db
        .select()
        .from(s.aiMessages)
        .where(eq(s.aiMessages.conversationId, r.conversationId))
    ).length,
  ).toBeGreaterThanOrEqual(4);
  await expect(
    executeTool(db, DEV_USER_ID, ai, 'publishExternally', {}),
  ).rejects.toThrow('disallowed');
});
it('rejected tool calls do not write and search returns saved content', async () => {
  const [c] = await db.select().from(s.aiConversations);
  const call = await queueTool(db, c.id, 'createIdea', {
    title: 'Rejected idea',
    rawNote: 'Do not save',
  });
  await approveTool(db, DEV_USER_ID, ai, call.id, false);
  expect(
    await db
      .select()
      .from(s.contentIdeas)
      .where(eq(s.contentIdeas.title, 'Rejected idea')),
  ).toHaveLength(0);
  const results = await executeTool(db, DEV_USER_ID, ai, 'searchIdeas', {
    query: 'retention',
  });
  expect(Array.isArray(results)).toBe(true);
  expect((results as unknown[]).length).toBeGreaterThan(0);
});
it('platform conversion writes a suggestion on the target, not the source', async () => {
  const p = await savePost(db, DEV_USER_ID, { title: 'Conversion' });
  const v = await saveVariant(db, {
    postId: p.id,
    platform: 'linkedin',
    body: 'A long and thoughtful founder story.',
  });
  const suggestion = await suggest(db, ai, v.id, 'Create X Version');
  expect(suggestion.variantId).not.toBe(v.id);
  const [original] = await db
    .select()
    .from(s.contentPostVariants)
    .where(eq(s.contentPostVariants.id, v.id));
  expect(original.body).toBe(v.body);
  expect(suggestion.original).toBe('');
});
it('Notion configurable properties preserve research and unknown dates', () => {
  const item = parseNotionPage(
    {
      id: 'notion-page',
      url: 'https://notion.so/page',
      last_edited_time: '2026-09-14T00:00:00Z',
      properties: {
        Headline: { title: [{ plain_text: 'Research paper' }] },
        Authors: { rich_text: [{ plain_text: 'A. Researcher' }] },
        Journal: { rich_text: [{ plain_text: 'Example Journal' }] },
        Category: { select: { name: 'Academic Research' } },
      },
    },
    'Abstract text',
    { title: 'Headline', author: 'Authors' },
  );
  expect(item.title).toBe('Research paper');
  expect(item.metadata?.author).toBe('A. Researcher');
  expect(item.metadata?.journal).toBe('Example Journal');
  expect(item.publishedAt).toBeNull();
  expect(item.metadata?.institution).toBeUndefined();
});
it('Notion pagination and nested blocks use only read-only calls', async () => {
  const calls: { url: string; method: string }[] = [];
  const http = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, method: init?.method || 'GET' });
    if (u.endsWith('/databases/db'))
      return Response.json({ data_sources: [{ id: 'ds' }] });
    if (u.endsWith('/data_sources/ds/query')) {
      const body = JSON.parse(String(init?.body));
      return Response.json(
        body.start_cursor
          ? { results: [], has_more: false }
          : {
              results: [
                {
                  id: 'p',
                  properties: { Name: { title: [{ plain_text: 'Page' }] } },
                },
              ],
              has_more: true,
              next_cursor: 'next',
            },
      );
    }
    return Response.json({
      results: [
        {
          type: 'paragraph',
          paragraph: { rich_text: [{ plain_text: 'Nested brief text' }] },
        },
      ],
      has_more: false,
    });
  });
  const items = await new NotionIntelligenceProvider(
    { key: 'test-key', databaseId: 'db' },
    http as typeof fetch,
  ).fetch();
  expect(items[0].rawText).toBe('Nested brief text');
  expect(
    calls
      .filter((c) => c.method === 'POST')
      .every((c) => c.url.endsWith('/query')),
  ).toBe(true);
  expect(calls.filter((c) => c.url.endsWith('/query'))).toHaveLength(2);
});
it('Groq routes primary and fast models from configuration, preserves tool calls and tokens', async () => {
  const bodies: Record<string, unknown>[] = [];
  const http = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({
      choices: [
        {
          message: {
            content: 'Draft',
            tool_calls: [
              {
                id: 'call',
                type: 'function',
                function: { name: 'searchPosts', arguments: '{"query":"AI"}' },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 12, completion_tokens: 5 },
    });
  });
  const provider = new GroqAIProvider(
    {
      GROQ_API_KEY: 'test-key',
      AI_PRIMARY_MODEL: 'primary-test',
      AI_FAST_MODEL: 'fast-test',
    },
    http as typeof fetch,
  );
  const r = await provider.complete({
    messages: [{ role: 'user', content: 'Write' }],
  });
  await provider.complete({
    messages: [{ role: 'user', content: 'Summarize' }],
    tier: 'fast',
  });
  expect(bodies.map((b) => b.model)).toEqual(['primary-test', 'fast-test']);
  expect(r.inputTokens).toBe(12);
  expect(r.toolCalls?.[0].function.name).toBe('searchPosts');
  await expect(
    new GroqAIProvider({ GROQ_API_KEY: 'test' }).generate('hi'),
  ).rejects.toThrow('AI_PRIMARY_MODEL');
});
it('audio supports mock and Groq multipart transcription', async () => {
  expect((await new MockTranscriptionProvider().transcribe()).mock).toBe(true);
  const http = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    expect((init?.body as FormData).get('model')).toBe('transcription-test');
    expect((init?.body as FormData).get('file')).toBeInstanceOf(File);
    return Response.json({ text: 'A useful voice note' });
  });
  const r = await new GroqTranscriptionProvider(
    { GROQ_API_KEY: 'test-key', AI_TRANSCRIPTION_MODEL: 'transcription-test' },
    http as typeof fetch,
  ).transcribe(new Uint8Array([1, 2]), 'audio/wav');
  expect(r).toEqual({ text: 'A useful voice note', mock: false });
});
it('relevance scoring is bounded and interpretable', () => {
  const r = scoreItem(
    {
      title: 'Prediction markets regulation',
      summary: 'PlayMind-related research',
      category: 'regulation',
      publishedAt: new Date(),
      importance: 3,
    },
    ['Prediction markets'],
    'Prediction markets are growing',
    [],
  );
  expect(r.relevance).toBeGreaterThan(50);
  expect(r.relevance).toBeLessThanOrEqual(100);
  expect(r.relevanceReasons.length).toBeGreaterThan(3);
});
it('reuses validated editorial analysis and avoids paid calls without related evidence', async () => {
  const [item] = await db
    .insert(s.intelligenceItems)
    .values({
      externalId: 'cache-evidence',
      source: 'test',
      title: 'Neuroretention findings',
      summary: 'Neuroretention changes the context.',
      rawText: 'The primary research text.',
      category: 'academic_research',
      importance: 3,
      relevance: 100,
    })
    .returning();
  const post = await savePost(db, DEV_USER_ID, { title: 'Cache verification' });
  const variant = await saveVariant(db, {
    postId: post.id,
    platform: 'x',
    body: 'Neuroretention deserves careful study.',
  });
  const complete = vi.fn(async () => ({
    text: JSON.stringify({
      recommendation: 'KEEP',
      reasons: ['Evidence supports this text.'],
      suggestedRevision: null,
      evidenceIds: [item.id],
    }),
    model: 'cache-test',
    inputTokens: 100,
    outputTokens: 20,
  }));
  const provider = {
    name: 'cache-test',
    complete,
    generate: async () => complete(),
  };
  await reviewOne(db, provider, variant);
  await reviewOne(db, provider, variant);
  expect(complete).toHaveBeenCalledTimes(1);
  await db
    .update(s.intelligenceItems)
    .set({ rawText: 'Corrected primary research text.' })
    .where(eq(s.intelligenceItems.id, item.id));
  await reviewOne(db, provider, variant);
  expect(complete).toHaveBeenCalledTimes(2);
  const unchanged = await reviewOne(db, provider, {
    ...variant,
    body: 'Xylophonically unprecedented.',
  });
  expect(unchanged.recommendation).toBe('KEEP');
  expect(complete).toHaveBeenCalledTimes(2);
});
