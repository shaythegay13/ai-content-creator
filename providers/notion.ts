import type { IntelligenceSourceProvider } from './contracts';
import type { IntelligenceRecord } from '../types/domain';
import { zonedInput } from '../lib/time';
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
function rich(v: unknown): string {
  return arr(v)
    .map((x) => {
      const r = obj(x);
      return String(r.plain_text || obj(r.text).content || '');
    })
    .join('');
}
function prop(v: unknown): string {
  const p = obj(v);
  if (p.title) return rich(p.title);
  if (p.rich_text) return rich(p.rich_text);
  if (p.url) return String(p.url);
  if (p.select) return String(obj(p.select).name || '');
  if (p.status) return String(obj(p.status).name || '');
  if (p.multi_select)
    return arr(p.multi_select)
      .map((x) => obj(x).name)
      .join(', ');
  if (p.people)
    return arr(p.people)
      .map((x) => obj(x).name)
      .filter(Boolean)
      .join(', ');
  if (p.date) return String(obj(p.date).start || '');
  if (p.number !== undefined && p.number !== null) return String(p.number);
  return '';
}
export type NotionMapping = Record<string, string>;
export type ResearchBlock = {
  id: string;
  type: string;
  text: string;
  urls: string[];
};
const categoryFor = (text: string) =>
  /legislation|bill\b/i.test(text)
    ? 'legislation'
    : /regulat|government/i.test(text)
      ? 'regulation'
      : /academic|paper|research/i.test(text)
        ? 'academic_research'
        : /prediction.market/i.test(text)
          ? 'prediction_market_news'
          : /sportsbook|sports.betting/i.test(text)
            ? 'sportsbook_news'
            : 'other';
export function parseDailyBrief(
  page: Obj,
  blocks: ResearchBlock[],
  mapping: NotionMapping = {},
) {
  const base = parseNotionPage(page, '', mapping);
  const sections: {
    id: string;
    title: string;
    category: string;
    blocks: ResearchBlock[];
  }[] = [];
  let category = 'other';
  let current = {
    id: String(page.id),
    title: `Research brief ${base.title}`,
    category,
    blocks: [] as ResearchBlock[],
  };
  for (const block of blocks) {
    if (/^heading_[123]$/.test(block.type)) {
      if (current.blocks.some((b) => b.text || b.urls.length))
        sections.push(current);
      const detected = categoryFor(block.text);
      if (detected !== 'other' || block.type !== 'heading_3')
        category = detected;
      current = {
        id: block.id,
        title: block.text,
        category,
        blocks: block.urls.length ? [{ ...block, text: '' }] : [],
      };
    } else current.blocks.push(block);
  }
  if (current.blocks.some((b) => b.text || b.urls.length))
    sections.push(current);
  return sections.map((section) => {
    const rawText = section.blocks
      .map((b) => [b.text, ...b.urls].filter(Boolean).join('\n'))
      .join('\n');
    const urls = [...new Set(section.blocks.flatMap((b) => b.urls))];
    return {
      ...base,
      externalId: `${page.id}:${section.id}`,
      title: section.title,
      category: section.category,
      summary: rawText.slice(0, 1200),
      rawText,
      sourceUrl: urls[0],
      publishedAt: null,
      notionUrl: base.notionUrl
        ? `${base.notionUrl.split('#')[0]}#${section.id.replaceAll('-', '')}`
        : undefined,
      metadata: {
        ...base.metadata,
        briefDate: base.title,
        publicationDate: null,
        sectionBlockId: section.id,
        sourceUrls: urls,
      },
    } satisfies IntelligenceRecord;
  });
}
const defaults: NotionMapping = {
  title: 'Name',
  category: 'Category',
  summary: 'Summary',
  sourceUrl: 'URL',
  source: 'Source',
  author: 'Author',
  publishedAt: 'Date',
  entities: 'Companies',
  jurisdiction: 'Jurisdiction',
  topics: 'Topics',
  tags: 'Tags',
  institution: 'Institution',
  journal: 'Journal',
  abstract: 'Abstract',
  bill: 'Bill',
  agency: 'Agency',
  status: 'Status',
  importantDates: 'Important dates',
};
export function parseNotionPage(
  page: Obj,
  rawText: string,
  mapping: NotionMapping = {},
): IntelligenceRecord {
  const properties = obj(page.properties);
  const m = { ...defaults, ...mapping };
  const get = (key: string) => prop(properties[m[key]]);
  const title =
    get('title') ||
    Object.values(properties)
      .map((p) => (obj(p).type === 'title' ? prop(p) : ''))
      .find(Boolean) ||
    'Untitled Notion item';
  const date = get('publishedAt');
  const validDate =
    date && !Number.isNaN(Date.parse(date)) ? new Date(date) : null;
  const metadata: Obj = {
    notionId: page.id,
    notionUpdatedTime: page.last_edited_time,
    discoveredAt: new Date().toISOString(),
    publicationDate: validDate?.toISOString() || null,
  };
  for (const key of [
    'source',
    'author',
    'jurisdiction',
    'institution',
    'journal',
    'abstract',
    'bill',
    'agency',
    'status',
    'importantDates',
  ]) {
    const value = get(key);
    if (value) metadata[key] = value;
  }
  return {
    externalId: String(page.id),
    source: 'notion',
    title,
    category: get('category').toLowerCase().replaceAll(' ', '_') || 'other',
    summary: get('summary') || get('abstract') || rawText.slice(0, 1200),
    sourceUrl: get('sourceUrl') || undefined,
    notionUrl: typeof page.url === 'string' ? page.url : undefined,
    publishedAt: validDate,
    importance: 2,
    rawText,
    entities: get('entities')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
    topics: get('topics')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
    tags: get('tags')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
    metadata,
  };
}
export class NotionIntelligenceProvider implements IntelligenceSourceProvider {
  constructor(
    private config: {
      key: string;
      databaseId?: string;
      pageId?: string;
      mapping?: NotionMapping;
      layout?: 'daily' | 'items';
      briefDate?: string;
      timezone?: string;
    },
    private request: typeof fetch = fetch,
  ) {}
  private async call(endpoint: string, body?: Obj): Promise<Obj> {
    // The only POST endpoint is read-only data-source query; no Notion mutation API is exposed.
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await this.request(
        `https://api.notion.com/v1/${endpoint}`,
        {
          method: body ? 'POST' : 'GET',
          headers: {
            Authorization: `Bearer ${this.config.key}`,
            'Notion-Version': '2025-09-03',
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(30000),
        },
      );
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        const delay = Math.min(
          Number(response.headers.get('retry-after') || 1) * 1000,
          5000,
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      if (!response.ok)
        throw new Error(
          `Notion read failed (${response.status}). Check integration access and the configured page/database ID.`,
        );
      return obj(await response.json());
    }
    throw new Error('Notion request retries exhausted');
  }
  private async list(endpoint: string, body?: Obj) {
    const results: Obj[] = [];
    let cursor: string | undefined;
    for (let count = 0; count < 100; count++) {
      const result = await this.call(
        body
          ? endpoint
          : `${endpoint}${endpoint.includes('?') ? '&' : '?'}page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`,
        body
          ? {
              ...body,
              page_size: 100,
              ...(cursor ? { start_cursor: cursor } : {}),
            }
          : undefined,
      );
      results.push(...arr(result.results).map(obj));
      if (!result.has_more) return results;
      cursor = String(result.next_cursor);
    }
    throw new Error(
      'Notion pagination limit reached; narrow the source. No partial sync was saved.',
    );
  }
  private async blocks(blockId: string, depth = 0): Promise<ResearchBlock[]> {
    if (depth > 12)
      throw new Error('Notion nesting limit reached; select a narrower page.');
    const blocks = await this.list(`blocks/${blockId}/children`);
    const lines: ResearchBlock[] = [];
    for (const b of blocks) {
      const payload = obj(b[String(b.type)]);
      const richParts = [
        ...arr(payload.rich_text),
        ...arr(payload.cells).flatMap(arr),
        ...arr(payload.caption),
      ];
      const line = arr(payload.cells).length
        ? arr(payload.cells).map(rich).join(' | ')
        : rich(payload.rich_text) ||
          rich(payload.caption) ||
          String(payload.title || '');
      const urls = richParts.flatMap((v) => {
        const r = obj(v);
        const url = r.href || obj(obj(r.text).link).url;
        return typeof url === 'string' && /^https?:\/\//.test(url) ? [url] : [];
      });
      urls.push(...(line.match(/https?:\/\/[^\s<>]+/g) || []));
      if (typeof payload.url === 'string' && /^https?:\/\//.test(payload.url))
        urls.push(payload.url);
      if (line || urls.length)
        lines.push({
          id: String(b.id),
          type: String(b.type),
          text: line,
          urls: [...new Set(urls)],
        });
      if (b.has_children)
        lines.push(...(await this.blocks(String(b.id), depth + 1)));
    }
    return lines;
  }
  async fetch() {
    const pages: Obj[] = [];
    if (this.config.databaseId) {
      const db = await this.call(`databases/${this.config.databaseId}`);
      for (const source of arr(db.data_sources)) {
        let query: Obj = {};
        if (this.config.layout === 'daily') {
          const date =
            this.config.briefDate ||
            zonedInput(
              new Date(),
              this.config.timezone || 'America/New_York',
            ).slice(0, 10);
          if (
            !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date
          )
            throw new Error(
              'Notion brief date must be a valid ISO date (YYYY-MM-DD).',
            );
          const schema = await this.call(`data_sources/${obj(source).id}`);
          const titleProperty =
            this.config.mapping?.title ||
            Object.entries(obj(schema.properties)).find(
              ([, value]) => obj(value).type === 'title',
            )?.[0];
          if (!titleProperty)
            throw new Error(
              'Could not identify the daily brief title property. Configure the title mapping.',
            );
          query = {
            filter: { property: titleProperty, title: { equals: date } },
          };
        }
        pages.push(
          ...(await this.list(`data_sources/${obj(source).id}/query`, query)),
        );
      }
    } else if (this.config.pageId) {
      const page = await this.call(`pages/${this.config.pageId}`);
      pages.push(page);
      const blocks = await this.list(`blocks/${this.config.pageId}/children`);
      for (const b of blocks)
        if (b.type === 'child_page')
          pages.push(await this.call(`pages/${b.id}`));
    } else
      throw new Error(
        'Configure NOTION_DAILY_BRIEF_DATABASE_ID or NOTION_DAILY_BRIEF_PAGE_ID.',
      );
    const items: IntelligenceRecord[] = [];
    if (this.config.layout === 'daily' && !pages.length)
      throw new Error(
        `No daily research brief found for ${this.config.briefDate || zonedInput(new Date(), this.config.timezone || 'America/New_York').slice(0, 10)}. Existing intelligence was kept.`,
      );
    for (const page of pages) {
      const blocks = await this.blocks(String(page.id));
      if (this.config.layout === 'daily') {
        const sections = parseDailyBrief(page, blocks, this.config.mapping);
        if (!sections.length)
          throw new Error(
            'The daily brief page has no readable research blocks. Existing intelligence was kept.',
          );
        items.push(...sections);
      } else
        items.push(
          parseNotionPage(
            page,
            blocks
              .map((b) => [b.text, ...b.urls].filter(Boolean).join('\n'))
              .join('\n'),
            this.config.mapping,
          ),
        );
    }
    return items;
  }
}
