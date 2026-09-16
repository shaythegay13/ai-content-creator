import { it, expect, vi } from 'vitest';
import {
  ModelBudget,
  requestBudget,
  boundedHistory,
  compactData,
  relevantExcerpt,
} from '../lib/ai-budget';
import {
  NotionIntelligenceProvider,
  parseDailyBrief,
} from '../providers/notion';
import { GroqAIProvider } from '../providers/groq';
const limits = { rpm: 30, rpd: 1000, tpm: 8000, tpd: 200000 };
it('reserves concurrent token budgets and releases only reconciled usage', () => {
  let now = 0;
  const b = new ModelBudget(() => now);
  const first = b.reserve(5000, limits);
  expect(first.waitMs).toBe(0);
  expect(b.reserve(4000, limits).waitMs).toBe(60001);
  first.settle?.(3000);
  expect(b.reserve(4000, limits).waitMs).toBe(0);
  now = 60001;
  expect(b.reserve(6000, limits).waitMs).toBe(0);
});
it('enforces request and rolling daily caps independently', () => {
  let now = 0;
  const b = new ModelBudget(() => now);
  expect(b.reserve(10, { ...limits, rpm: 1 }).waitMs).toBe(0);
  expect(b.reserve(10, { ...limits, rpm: 1 }).waitMs).toBeGreaterThan(0);
  now = 60001;
  expect(() => b.reserve(10, { ...limits, rpd: 1 })).toThrow('daily');
  expect(() => b.reserve(200, { ...limits, tpd: 100 })).toThrow('daily');
  now = 86400001;
  expect(b.reserve(10, { ...limits, rpd: 1 }).waitMs).toBe(0);
});
it('rejects oversized prompts before sending and uses smaller fast output budgets', async () => {
  expect(
    requestBudget({
      messages: [{ role: 'user', content: 'Summarize' }],
      tier: 'fast',
    }).output,
  ).toBe(600);
  const http = vi.fn();
  const p = new GroqAIProvider(
    { GROQ_API_KEY: 'budget-test', AI_PRIMARY_MODEL: 'test' },
    http as typeof fetch,
  );
  await expect(p.generate('research '.repeat(10000))).rejects.toThrow('6,000');
  expect(http).not.toHaveBeenCalled();
});
it('bounds history without altering retained messages and drops raw record payloads', () => {
  const recent = { role: 'user' as const, content: 'Use angle two' };
  expect(
    boundedHistory(
      [{ role: 'assistant', content: 'x'.repeat(10000) }, recent],
      200,
    ),
  ).toEqual([recent]);
  expect(
    compactData(
      { id: 'keep', rawText: 'x'.repeat(50000), summary: 'y'.repeat(1000) },
      50,
    ),
  ).toEqual({ id: 'keep', summary: 'y'.repeat(50) + ' [excerpt]' });
});
it('queries the ISO daily title and reads nested, paginated body research with source links', async () => {
  const calls: { url: string; body: unknown; method: string }[] = [];
  const page = {
    id: 'day-page',
    url: 'https://notion.so/day-page',
    properties: {
      Day: { type: 'title', title: [{ plain_text: '2026-09-14' }] },
      Date: { date: { start: '2026-09-14' } },
    },
  };
  const http = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url: u, body, method: init?.method || 'GET' });
    if (u.endsWith('/databases/db'))
      return Response.json({ data_sources: [{ id: 'ds' }] });
    if (u.endsWith('/data_sources/ds'))
      return Response.json({ properties: { Day: { type: 'title' } } });
    if (u.endsWith('/query'))
      return Response.json({ results: [page], has_more: false });
    if (u.includes('/blocks/day-page/children') && !u.includes('start_cursor'))
      return Response.json({
        results: [
          {
            id: 'heading-a',
            type: 'heading_2',
            heading_2: {
              rich_text: [{ plain_text: 'Prediction market research' }],
            },
          },
          {
            id: 'toggle',
            type: 'toggle',
            has_children: true,
            toggle: { rich_text: [{ plain_text: 'Retention study' }] },
          },
        ],
        has_more: true,
        next_cursor: 'cursor2',
      });
    if (u.includes('/blocks/toggle/children'))
      return Response.json({
        results: [
          {
            id: 'table-row',
            type: 'table_row',
            table_row: {
              cells: [[{ plain_text: 'Operator' }], [{ plain_text: '42%' }]],
            },
          },
          {
            id: 'nested',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  plain_text: 'The detailed findings live here.',
                  href: 'https://example.org/paper',
                },
              ],
            },
          },
        ],
        has_more: false,
      });
    if (u.includes('start_cursor=cursor2'))
      return Response.json({
        results: [
          {
            id: 'heading-b',
            type: 'heading_2',
            heading_2: { rich_text: [{ plain_text: 'Legislation update' }] },
          },
          {
            id: 'body-b',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                { plain_text: 'A proposed bill, not an enacted rule.' },
              ],
            },
          },
        ],
        has_more: false,
      });
    throw new Error('Unexpected URL ' + u);
  });
  const provider = new NotionIntelligenceProvider(
    { key: 'test', databaseId: 'db', layout: 'daily', briefDate: '2026-09-14' },
    http as typeof fetch,
  );
  const items = await provider.fetch();
  expect(items).toHaveLength(2);
  expect(calls.find((c) => c.url.endsWith('/query'))?.body).toEqual({
    filter: { property: 'Day', title: { equals: '2026-09-14' } },
    page_size: 100,
  });
  expect(items[0].rawText).toContain('detailed findings');
  expect(items[0].rawText).toContain('Operator | 42%');
  expect(items[0].sourceUrl).toBe('https://example.org/paper');
  expect(items[0].metadata?.briefDate).toBe('2026-09-14');
  expect(items[0].publishedAt).toBeNull();
  expect(items[0].externalId).toBe('day-page:heading-a');
  expect(items[1].category).toBe('legislation');
  expect((await provider.fetch()).map((i) => i.externalId)).toEqual(
    items.map((i) => i.externalId),
  );
  expect(
    calls
      .filter((c) => c.method === 'POST')
      .every((c) => c.url.endsWith('/query')),
  ).toBe(true);
});
it('retrieves matching research below the beginning of a long brief', () => {
  const text =
    'Unrelated preamble.\n'.repeat(500) +
    'Neuroretention findings are here.\nDetailed evidence.';
  expect(relevantExcerpt(text, 'Neuroretention', 100)).toContain(
    'findings are here',
  );
  expect(relevantExcerpt(text, 'Neuroretention', 100).length).toBeLessThan(115);
});
it('uses page body when properties are empty and keeps IDs stable when text changes', () => {
  const page = {
    id: 'p',
    properties: { Name: { title: [{ plain_text: '2026-09-14' }] } },
  };
  const block = {
    id: 'b',
    type: 'paragraph',
    text: 'Body-only research',
    urls: [],
  };
  const first = parseDailyBrief(page, [block]);
  const changed = parseDailyBrief(page, [
    { ...block, text: 'Corrected research' },
  ]);
  expect(first[0].rawText).toBe('Body-only research');
  expect(changed[0].externalId).toBe(first[0].externalId);
});
it('keeps heading source links and does not inherit research labels into unrelated sections', () => {
  const rows = parseDailyBrief({ id: 'p', properties: {} }, [
    {
      id: 'h1',
      type: 'heading_2',
      text: 'Academic research',
      urls: ['https://example.org/research'],
    },
    { id: 'b1', type: 'paragraph', text: 'Study text', urls: [] },
    { id: 'h2', type: 'heading_2', text: 'Sources', urls: [] },
    { id: 'b2', type: 'paragraph', text: 'Bibliography', urls: [] },
  ]);
  expect(rows[0].sourceUrl).toBe('https://example.org/research');
  expect(rows[1].category).toBe('other');
});
it('reports a missing daily entry without crawling an unrelated day', async () => {
  const http = vi.fn(async (url: RequestInfo | URL) =>
    Response.json(
      String(url).includes('/databases/')
        ? { data_sources: [{ id: 'ds' }] }
        : String(url).endsWith('/query')
          ? { results: [], has_more: false }
          : { properties: { Name: { type: 'title' } } },
    ),
  );
  await expect(
    new NotionIntelligenceProvider(
      {
        key: 'test',
        databaseId: 'db',
        layout: 'daily',
        briefDate: '2026-09-14',
      },
      http as typeof fetch,
    ).fetch(),
  ).rejects.toThrow('No daily research brief');
  expect(
    http.mock.calls.every(([url]) => !String(url).includes('/blocks/')),
  ).toBe(true);
});
