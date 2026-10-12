'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { Workspace } from '@/services/workspace';
import { UploadForm } from '@/components/forms';
import { PlatformTargets } from './editor';
import {
  Title,
  Field,
  Button,
  Notice,
  useManage,
  split,
  safeLink,
} from './shared';
export function Ideas({ data }: { data: Workspace }) {
  const [platforms, setPlatforms] = useState(['x', 'linkedin']);
  const [converting, setConverting] = useState(false);
  const [initialDate] = useState(() => new Date().toISOString());
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<string>('new');
  const { run, busy, notice } = useManage();
  const router = useRouter();
  const idea = data.ideas.find((i) => i.id === selected);
  return (
    <>
      <Title
        title="Ideas"
        description="Capture, develop, and turn a thought into a post."
      >
        <Button onClick={() => setSelected('new')}>New idea</Button>
      </Title>
      <PlatformTargets value={platforms} onChange={setPlatforms} />
      {converting && (
        <p role="status">
          Creating post…{' '}
          {data.generationSettings.autoGenerate
            ? `Understanding notes, choosing angles, and drafting/reviewing ${platforms.map((p) => (p === 'x' ? 'X' : 'LinkedIn')).join(' and ')}. This may pause for the AI minute budget; each result will appear in the editor.`
            : 'Automatic generation is disabled; preparing blank variants.'}
        </p>
      )}
      <div className="filter-bar">
        <input
          placeholder="Search ideas…"
          aria-label="Search ideas"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Idea source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="">All sources</option>
          {[...new Set(data.ideas.map((i) => i.source))].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Idea status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {['inbox', 'developing', 'converted', 'archived'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="split-layout">
        <section className="panel idea-list">
          {data.ideas
            .filter(
              (i) =>
                `${i.title} ${i.rawNote} ${i.tags}`
                  .toLowerCase()
                  .includes(query.toLowerCase()) &&
                (!source || i.source === source) &&
                (!status || i.status === status),
            )
            .map((i) => (
              <article key={i.id}>
                <button className="text-left" onClick={() => setSelected(i.id)}>
                  <h3>{i.title}</h3>
                  <p>{i.rawNote}</p>
                </button>
                <div className="button-row">
                  <span className="badge">{i.status}</span>
                  <span className="badge">
                    {i.source} · Priority {i.priority}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || !platforms.length}
                    onClick={async () => {
                      setConverting(true);
                      try {
                        await run('convertIdea', { id: i.id, platforms }, (d) =>
                          router.push(`/posts/${(d as { id: string }).id}`),
                        );
                      } finally {
                        setConverting(false);
                      }
                    }}
                  >
                    Convert to post
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm('Archive this idea?'))
                        run('archiveIdea', { id: i.id, confirmed: true });
                    }}
                  >
                    Archive
                  </Button>
                </div>
              </article>
            ))}
        </section>
        <form
          key={selected}
          className="panel form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(
              'saveIdea',
              {
                id: idea?.id,
                title: f.get('title'),
                rawNote: f.get('note'),
                source: f.get('source'),
                topicId: f.get('topic') || null,
                tags: split(String(f.get('tags'))),
                priority: Number(f.get('priority')),
                sourceUrl: f.get('url'),
                status: f.get('status'),
                createdAt: new Date(String(f.get('date')) + 'T12:00:00Z'),
                mediaIds: f.getAll('media'),
              },
              (d) => setSelected((d as { id: string }).id),
            );
          }}
        >
          <h2>{idea ? 'Edit idea' : 'Capture an idea'}</h2>
          <Field label="Idea title">
            <input name="title" defaultValue={idea?.title} required />
          </Field>
          <Field label="Raw note">
            <textarea name="note" rows={5} defaultValue={idea?.rawNote} />
          </Field>
          <div className="two-column">
            <Field label="Source">
              <select name="source" defaultValue={idea?.source || 'manual'}>
                {[
                  'manual',
                  'ai',
                  'notion',
                  'trend',
                  'conversation',
                  'voice',
                  'social',
                  'other',
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Topic">
              <select name="topic" defaultValue={idea?.topicId || ''}>
                <option value="">None</option>
                {data.topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Tags (comma separated)">
            <input name="tags" defaultValue={idea?.tags.join(', ')} />
          </Field>
          <div className="two-column">
            <Field label="Priority">
              <select name="priority" defaultValue={idea?.priority || 2}>
                <option value="1">Low</option>
                <option value="2">Normal</option>
                <option value="3">High</option>
              </select>
            </Field>
            <Field label="Date">
              <input
                type="date"
                name="date"
                required
                defaultValue={new Date(idea?.createdAt || initialDate)
                  .toISOString()
                  .slice(0, 10)}
              />
            </Field>
          </div>
          <Field label="Source URL">
            <input type="url" name="url" defaultValue={idea?.sourceUrl || ''} />
          </Field>
          <Field label="Status">
            <select name="status" defaultValue={idea?.status || 'inbox'}>
              {['inbox', 'developing', 'converted', 'archived'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <fieldset>
            <legend className="field-label">Attached media</legend>
            {data.media.map((m) => (
              <label className="check-row" key={m.id}>
                <input
                  name="media"
                  type="checkbox"
                  value={m.id}
                  defaultChecked={data.ideaMedia.some(
                    (r) => r.ideaId === idea?.id && r.mediaId === m.id,
                  )}
                />
                {m.filename}
              </label>
            ))}
          </fieldset>
          <Button disabled={busy}>Save idea</Button>
          <Notice text={notice} />
        </form>
      </div>
    </>
  );
}
export function Posts({ data }: { data: Workspace }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  return (
    <>
      <Title
        title="Posts"
        description="Every concept, with its linked platform variants."
      >
        <Button asChild>
          <Link href="/create">New post</Link>
        </Button>
      </Title>
      <div className="filter-bar">
        <input
          aria-label="Filter posts"
          placeholder="Search posts…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="Filter post status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {[
            'idea',
            'draft',
            'review',
            'ready',
            'scheduled',
            'published',
            'archived',
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="panel table-scroll">
        <table>
          <thead>
            <tr>
              <th>Concept</th>
              <th>Pillar</th>
              <th>Platforms</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.posts
              .filter(
                (p) =>
                  `${p.title} ${p.coreIdea}`
                    .toLowerCase()
                    .includes(q.toLowerCase()) &&
                  (!status || p.status === status),
              )
              .map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/posts/${p.id}`}>{p.title} ↗</Link>
                  </td>
                  <td>{p.pillar || '—'}</td>
                  <td>
                    {data.variants
                      .filter((v) => v.postId === p.id)
                      .map((v) => v.platform)
                      .join(' + ')}
                  </td>
                  <td>
                    <span className="badge">{p.status}</span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
export function Media({ data }: { data: Workspace }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [usage, setUsage] = useState('');
  return (
    <>
      <Title
        title="Media"
        description="Your photos, clips, and voice notes — ready for a story."
      />
      <div className="filter-bar">
        <input
          placeholder="Search media, descriptions, tags…"
          aria-label="Search media"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="Media type"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="">All types</option>
          {['image', 'video', 'audio'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Media usage"
          value={usage}
          onChange={(e) => setUsage(e.target.value)}
        >
          <option value="">Used + unused</option>
          <option>used</option>
          <option>unused</option>
        </select>
      </div>
      <div className="split-layout">
        <div className="asset-grid">
          {data.media
            .filter(
              (m) =>
                `${m.filename} ${m.description} ${m.tags} ${m.detectedTopics}`
                  .toLowerCase()
                  .includes(q.toLowerCase()) &&
                (!kind || m.kind === kind) &&
                (!usage || m.usageStatus === usage),
            )
            .map((m) => (
              <MediaCard key={m.id} media={m} data={data} />
            ))}
        </div>
        <section className="panel">
          <h2 className="mb-5">Upload media</h2>
          <UploadForm />
        </section>
      </div>
    </>
  );
}
function MediaCard({
  media: m,
  data,
}: {
  media: Workspace['media'][number];
  data: Workspace;
}) {
  const { run, busy, notice } = useManage();
  const src = `/api/media/${m.id}`;
  return (
    <article className="panel media-edit-card">
      {m.storageProvider === 'mock' ? (
        <div className="media-preview">{m.kind} metadata example</div>
      ) : m.kind === 'image' ? (
        <a href={src} target="_blank" rel="noreferrer">
          <Image
            unoptimized
            src={src}
            alt={m.description || m.filename}
            width={500}
            height={300}
            className="asset-image"
          />
        </a>
      ) : m.kind === 'video' ? (
        <video src={src} controls preload="metadata" className="asset-image" />
      ) : (
        <audio src={src} controls preload="metadata" />
      )}
      <h3 className="my-3">{m.filename}</h3>
      <p className="muted text-xs">
        {m.mimeType} · {(m.size / 1024).toFixed(0)} KB · {m.usageStatus}
      </p>
      <form
        className="form-stack mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run('saveMedia', {
            id: m.id,
            description: f.get('description'),
            tags: split(String(f.get('tags'))),
            detectedTopics: split(String(f.get('topics'))),
          });
        }}
      >
        <Field label="Description">
          <textarea name="description" defaultValue={m.description} />
        </Field>
        <Field label="Tags">
          <input name="tags" defaultValue={m.tags.join(', ')} />
        </Field>
        <Field label="Topics">
          <input name="topics" defaultValue={m.detectedTopics.join(', ')} />
        </Field>
        <Button disabled={busy} size="sm">
          Save metadata
        </Button>
      </form>
      <div className="mt-4">
        <h3>Used in</h3>
        {data.postMedia
          .filter((r) => r.mediaId === m.id)
          .map((r) => (
            <Link
              key={r.postId}
              className="search-result"
              href={`/posts/${r.postId}`}
            >
              {data.posts.find((p) => p.id === r.postId)?.title}
            </Link>
          ))}
      </div>
      <Notice text={notice} />
    </article>
  );
}
export function Intelligence({ data }: { data: Workspace }) {
  const [briefDate, setBriefDate] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [topic, setTopic] = useState('');
  const [entity, setEntity] = useState('');
  const [source, setSource] = useState('');
  const [date, setDate] = useState('');
  const [relevance, setRelevance] = useState('0');
  const [used, setUsed] = useState('');
  const [dismissed, setDismissed] = useState('active');
  const { run, busy, notice } = useManage();
  const rows = data.intelligence.filter(
    (i) =>
      `${i.title} ${i.summary} ${i.rawText || ''}`
        .toLowerCase()
        .includes(q.toLowerCase()) &&
      (!category || i.category === category) &&
      (!topic || i.topics.includes(topic)) &&
      (!entity || i.entities.includes(entity)) &&
      (!source || i.source === source) &&
      (!date ||
        new Date(i.publishedAt || i.createdAt).toISOString().slice(0, 10) >=
          date) &&
      i.relevance >= Number(relevance) &&
      (dismissed === 'all' || i.dismissed === (dismissed === 'dismissed')) &&
      (!used ||
        data.intelligencePosts.some((r) => r.intelligenceId === i.id) ===
          (used === 'used')),
  );
  return (
    <>
      <Title
        title="Intelligence"
        description="Read-only Notion briefs, with source context and transparent relevance."
      >
        <div className="filter-bar">
          <Field label="Brief to sync (blank means today)">
            <input
              type="date"
              value={briefDate}
              onChange={(e) => setBriefDate(e.target.value)}
            />
          </Field>
          <Button disabled={busy} onClick={() => run('sync', { briefDate })}>
            {busy ? 'Syncing and reviewing…' : 'Sync now'}
          </Button>
        </div>
      </Title>
      <Notice text={notice} />
      <div className="filter-bar">
        <input
          aria-label="Search intelligence"
          placeholder="Search intelligence…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {[
          {
            label: 'Category',
            value: category,
            set: setCategory,
            options: [...new Set(data.intelligence.map((i) => i.category))],
          },
          {
            label: 'Topic',
            value: topic,
            set: setTopic,
            options: [...new Set(data.intelligence.flatMap((i) => i.topics))],
          },
          {
            label: 'Entity',
            value: entity,
            set: setEntity,
            options: [...new Set(data.intelligence.flatMap((i) => i.entities))],
          },
          {
            label: 'Source',
            value: source,
            set: setSource,
            options: [...new Set(data.intelligence.map((i) => i.source))],
          },
        ].map((f) => (
          <select
            key={f.label}
            aria-label={`Intelligence ${f.label}`}
            value={f.value}
            onChange={(e) => f.set(e.target.value)}
          >
            <option value="">All {f.label.toLowerCase()}s</option>
            {f.options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        ))}
        <input
          type="date"
          aria-label="Intelligence since date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <select
          aria-label="Minimum relevance"
          value={relevance}
          onChange={(e) => setRelevance(e.target.value)}
        >
          <option value="0">All relevance</option>
          <option value="35">35+ relevant</option>
          <option value="60">60+ highly relevant</option>
        </select>
        <select
          aria-label="Used in content"
          value={used}
          onChange={(e) => setUsed(e.target.value)}
        >
          <option value="">Any usage</option>
          <option value="used">Used in content</option>
          <option value="unused">Unused</option>
        </select>
        <select
          aria-label="Dismissed intelligence"
          value={dismissed}
          onChange={(e) => setDismissed(e.target.value)}
        >
          <option value="active">Active</option>
          <option value="dismissed">Dismissed</option>
          <option value="all">All</option>
        </select>
      </div>
      <p className="muted text-xs mb-4">
        {rows.length} items · Last sync:{' '}
        {data.syncRuns[0]?.status || 'not yet run'}
      </p>
      <div className="column-stack">
        {rows.map((i) => (
          <details className="panel intelligence-detail" key={i.id}>
            <summary>
              <span className="badge">{i.category.replaceAll('_', ' ')}</span>
              <strong>{i.title}</strong>
              <span className="badge">
                {i.relevance}/100 · {i.source}
              </span>
            </summary>
            <p className="preserve my-4">{i.summary}</p>
            <div className="button-row">
              {safeLink(i.sourceUrl) && (
                <a
                  href={safeLink(i.sourceUrl)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read source ↗
                </a>
              )}
              {safeLink(i.notionUrl) && (
                <a
                  href={safeLink(i.notionUrl)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Notion ↗
                </a>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  run('dismissIntelligence', {
                    id: i.id,
                    dismissed: !i.dismissed,
                  })
                }
              >
                {i.dismissed ? 'Restore' : 'Dismiss'}
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  run('saveIdea', {
                    title: i.title,
                    rawNote: i.summary,
                    source: 'notion',
                    sourceUrl: i.sourceUrl || '',
                  })
                }
              >
                Create idea
              </Button>
            </div>
            <h3 className="mt-5">Why relevant</h3>
            <ul className="evidence-list">
              {i.relevanceReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="muted text-xs">
              Published:{' '}
              {i.publishedAt
                ? new Date(i.publishedAt).toLocaleDateString()
                : 'Unknown'}{' '}
              · Discovered: {new Date(i.createdAt).toLocaleDateString()}
            </p>
            <h3 className="mt-5">Related posts (title/topic overlap)</h3>
            {data.posts
              .filter((p) =>
                i.title
                  .toLowerCase()
                  .split(' ')
                  .some(
                    (w) =>
                      w.length > 5 &&
                      `${p.title} ${p.pillar}`.toLowerCase().includes(w),
                  ),
              )
              .slice(0, 5)
              .map((p) => (
                <Link
                  className="search-result"
                  key={p.id}
                  href={`/posts/${p.id}`}
                >
                  {p.title} · {p.status}
                </Link>
              ))}
            <h3 className="mt-5">Imported metadata</h3>
            <dl className="metadata-list">
              {Object.entries(
                (i.metadata || {}) as Record<string, unknown>,
              ).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>
                    {typeof value === 'object'
                      ? JSON.stringify(value)
                      : String(value ?? 'Unknown')}
                  </dd>
                </div>
              ))}
            </dl>
            {i.rawText && (
              <details>
                <summary>Raw relevant text</summary>
                <p className="preserve">{i.rawText}</p>
              </details>
            )}
          </details>
        ))}
      </div>
    </>
  );
}
