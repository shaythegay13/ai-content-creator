import type { IntelligenceSourceProvider } from './contracts';
import type { IntelligenceRecord } from '../types/domain';
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
  private async blocks(blockId: string, depth = 0): Promise<string> {
    if (depth > 12)
      throw new Error('Notion nesting limit reached; select a narrower page.');
    const blocks = await this.list(`blocks/${blockId}/children`);
    const lines: string[] = [];
    for (const b of blocks) {
      const payload = obj(b[String(b.type)]);
      const line = rich(payload.rich_text) || String(payload.title || '');
      if (line) lines.push(line);
      if (payload.url) lines.push(String(payload.url));
      if (b.has_children)
        lines.push(await this.blocks(String(b.id), depth + 1));
    }
    return lines.join('\n');
  }
  async fetch() {
    const pages: Obj[] = [];
    if (this.config.databaseId) {
      const db = await this.call(`databases/${this.config.databaseId}`);
      for (const source of arr(db.data_sources)) {
        pages.push(
          ...(await this.list(`data_sources/${obj(source).id}/query`, {})),
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
    for (const page of pages)
      items.push(
        parseNotionPage(
          page,
          await this.blocks(String(page.id)),
          this.config.mapping,
        ),
      );
    return items;
  }
}
