'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Workspace } from '@/services/workspace';
import { zonedInput } from '@/lib/time';
import { Button, Field, Title, Notice, useManage } from './shared';
const actions = [
  'Generate Draft',
  'Improve Hook',
  'Shorten',
  'Expand',
  'Make More Conversational',
  'Make More Founder-Like',
  'Make Less Promotional',
  'Create X Version',
  'Create LinkedIn Version',
  'Generate Five Hooks',
  'Generate Content Angles',
  'Suggest CTA',
  'Rewrite Using Intelligence',
  'Rewrite Using Trend',
];
export function NewContent({ date = '' }: { date?: string }) {
  const { run, busy, notice } = useManage();
  const router = useRouter();
  return (
    <>
      <Title
        title="Create content"
        description="Start with one concept. Give each platform its own version."
      />
      <form
        className="panel form-stack narrow"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const r = await run('savePost', {
            title: f.get('title'),
            coreIdea: f.get('body'),
          });
          if (r.ok) {
            const post = r.data as { id: string };
            for (const platform of ['x', 'linkedin'])
              await run('saveVariant', {
                postId: post.id,
                platform,
                body: String(f.get('body')),
              });
            router.push(`/posts/${post.id}${date ? `?date=${date}` : ''}`);
          }
        }}
      >
        <Field label="Title">
          <input name="title" required />
        </Field>
        <Field label="Core idea">
          <textarea name="body" rows={6} required />
        </Field>
        <Button disabled={busy}>Create draft with X + LinkedIn variants</Button>
        <Notice text={notice} />
      </form>
    </>
  );
}
export function Editor({
  data,
  id,
  zone,
  date = '',
}: {
  data: Workspace;
  id: string;
  zone: string;
  date?: string;
}) {
  const post = data.posts.find((p) => p.id === id)!;
  const { run, busy, notice } = useManage();
  const router = useRouter();
  const [selected, setSelected] = useState(
    data.postMedia.filter((m) => m.postId === id).map((m) => m.mediaId),
  );
  return (
    <>
      <Title
        title={post.title}
        description="One content concept. Independent platform versions and schedules."
      >
        <Link href="/posts">← All posts</Link>
      </Title>
      <div className="editor-layout">
        <div className="column-stack">
          <form
            className="panel form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run('savePost', {
                id,
                title: f.get('title'),
                coreIdea: f.get('coreIdea'),
                pillar: f.get('pillar'),
                notes: f.get('notes'),
                sourceReferences: String(f.get('sources'))
                  .split('\n')
                  .filter(Boolean),
                status: f.get('status'),
              });
            }}
          >
            <h2>Content concept</h2>
            <Field label="Internal title">
              <input name="title" defaultValue={post.title} required />
            </Field>
            <Field label="Core idea">
              <textarea name="coreIdea" rows={3} defaultValue={post.coreIdea} />
            </Field>
            <div className="two-column">
              <Field label="Content pillar">
                <input name="pillar" list="topics" defaultValue={post.pillar} />
                <datalist id="topics">
                  {data.topics.map((t) => (
                    <option key={t.id}>{t.name}</option>
                  ))}
                </datalist>
              </Field>
              <Field label="Concept status">
                <select name="status" defaultValue={post.status}>
                  {[
                    'idea',
                    'draft',
                    'review',
                    'ready',
                    'scheduled',
                    'archived',
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Notes">
              <textarea name="notes" defaultValue={post.notes} />
            </Field>
            <Field label="Source references (one URL per line)">
              <textarea
                name="sources"
                defaultValue={post.sourceReferences.join('\n')}
              />
            </Field>
            <div className="button-row">
              <Button disabled={busy}>Save concept</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  run('duplicate', { id }, (d) =>
                    router.push(`/posts/${(d as { id: string }).id}`),
                  )
                }
              >
                Duplicate
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (
                    confirm(
                      'Archive this concept and remove its scheduled entries?',
                    )
                  )
                    run('archive', { id, confirmed: true });
                }}
              >
                Archive
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (
                    confirm(
                      'Permanently delete this concept and all its variants?',
                    )
                  )
                    run('delete', { id, confirmed: true }, () =>
                      router.push('/posts'),
                    );
                }}
              >
                Delete
              </Button>
            </div>
          </form>
          {data.variants
            .filter((v) => v.postId === id)
            .sort((a, b) =>
              a.platform === b.platform ? 0 : a.platform === 'x' ? -1 : 1,
            )
            .map((v) => (
              <VariantEditor
                key={v.id}
                data={data}
                variant={v}
                zone={zone}
                date={date}
              />
            ))}
          <div className="panel button-row">
            {['x', 'linkedin']
              .filter(
                (p) =>
                  !data.variants.some(
                    (v) => v.postId === id && v.platform === p,
                  ),
              )
              .map((platform) => (
                <Button
                  key={platform}
                  disabled={busy}
                  onClick={() =>
                    run('saveVariant', {
                      postId: id,
                      platform,
                      body: post.coreIdea,
                    })
                  }
                >
                  Add {platform} version
                </Button>
              ))}
          </div>
        </div>
        <aside className="column-stack">
          <section className="panel">
            <h2>Attached media</h2>
            <p className="muted text-xs my-3">
              Choose assets from your library.
            </p>
            <div className="media-picker">
              {data.media.map((m) => (
                <label key={m.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(m.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, m.id]
                          : selected.filter((x) => x !== m.id),
                      )
                    }
                  />
                  <span>
                    {m.filename}
                    <small>
                      {m.kind} · {m.usageStatus}
                    </small>
                  </span>
                </label>
              ))}
            </div>
            <Button
              disabled={busy}
              onClick={() =>
                run('attachMedia', { postId: id, mediaIds: selected })
              }
            >
              Save attachments
            </Button>
            <Link className="quiet-link mt-4" href="/media">
              Upload more media →
            </Link>
          </section>
          <section className="panel">
            <h2>Publishing is off</h2>
            <p className="muted text-sm mt-3">
              Scheduling organizes your calendar. Nothing is sent to X or
              LinkedIn.
            </p>
          </section>
          <Notice text={notice} />
        </aside>
      </div>
    </>
  );
}
function VariantEditor({
  data,
  variant: v,
  zone,
  date,
}: {
  data: Workspace;
  variant: Workspace['variants'][number];
  zone: string;
  date: string;
}) {
  const { run, busy, notice } = useManage();
  const [body, setBody] = useState(v.body);
  const [savedBody, setSavedBody] = useState(v.body);
  if (savedBody !== v.body) {
    setSavedBody(v.body);
    setBody(v.body);
  }
  const [action, setAction] = useState(actions[0]);
  const [extra, setExtra] = useState('');
  const entry = data.calendar.find((c) => c.variantId === v.id);
  const pending = data.suggestions.filter(
    (s) => s.variantId === v.id && s.state === 'pending',
  );
  return (
    <section className="panel form-stack">
      <div className="flex justify-between">
        <h2>{v.platform === 'x' ? 'X' : 'LinkedIn'} version</h2>
        <span className="badge">{v.status}</span>
      </div>
      <Field label={`${v.platform === 'x' ? 'X' : 'LinkedIn'} text`}>
        <textarea
          rows={v.platform === 'x' ? 5 : 10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </Field>
      <p
        className={
          v.platform === 'x' && body.length > 280
            ? 'warning-text'
            : 'muted text-xs'
        }
      >
        {body.length} characters
        {v.platform === 'x' && body.length > 280
          ? ' · Above the standard 280-character limit; shorten or check your account capabilities.'
          : ''}
        {v.platform === 'linkedin' && body.length > 3000
          ? ' · Above the usual 3,000-character limit.'
          : ''}
      </p>
      <div className="button-row">
        <Button
          disabled={busy}
          onClick={() => run('saveVariant', { ...v, body })}
        >
          Save {v.platform} text
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => run('saveVariant', { ...v, body, status: 'ready' })}
        >
          Mark ready
        </Button>
        <Field label="Variant status">
          <select
            value={v.status}
            onChange={(e) =>
              run('saveVariant', { ...v, body, status: e.target.value })
            }
          >
            {['draft', 'review', 'ready', 'scheduled', 'archived'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      </div>
      <form
        className="schedule-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run('schedule', {
            variantId: v.id,
            localTime: f.get('when'),
            timezone: zone,
          });
        }}
      >
        <Field label={`Schedule ${v.platform} (${zone})`}>
          <input
            type="datetime-local"
            name="when"
            required
            defaultValue={
              entry
                ? zonedInput(entry.scheduledAt, zone)
                : date
                  ? `${date}T10:00`
                  : ''
            }
          />
        </Field>
        <Button disabled={busy}>Schedule {v.platform}</Button>
      </form>
      <div className="ai-action-box">
        <h3>Work on this version with AI</h3>
        <select
          aria-label={`AI action for ${v.platform}`}
          value={action}
          onChange={(e) => setAction(e.target.value)}
        >
          {actions.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        {/Intelligence|Trend/.test(action) ? (
          <select
            aria-label="Supporting context"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
          >
            <option value="">Choose supporting context</option>
            {(action.includes('Intelligence')
              ? data.intelligence
              : data.trends
            ).map((i) => (
              <option
                key={i.id}
                value={JSON.stringify({
                  id: i.id,
                  title: i.title,
                  summary: i.summary,
                  sourceUrl: 'sourceUrl' in i ? i.sourceUrl : null,
                })}
              >
                {i.title}
              </option>
            ))}
          </select>
        ) : null}
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            if (body !== v.body) {
              alert('Save your current text before generating a suggestion.');
              return;
            }
            run('suggest', { variantId: v.id, action, extra });
          }}
        >
          Generate suggestion
        </Button>
      </div>
      {pending.map((s) => (
        <Suggestion key={s.id} suggestion={s} />
      ))}
      <Notice text={notice} />
    </section>
  );
}
function Suggestion({
  suggestion: s,
}: {
  suggestion: Workspace['suggestions'][number];
}) {
  const { run, busy, notice } = useManage();
  const [text, setText] = useState(s.suggested);
  return (
    <div className="suggestion-box">
      <h3>{s.action} · Awaiting your approval</h3>
      <div className="two-column">
        <div>
          <p className="tiny-label">ORIGINAL</p>
          <p className="preserve">{s.original}</p>
        </div>
        <Field label="SUGGESTED — edit before accepting">
          <textarea
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
      </div>
      <div className="button-row">
        <Button
          disabled={busy}
          onClick={() =>
            run('decideSuggestion', {
              id: s.id,
              decision: text === s.suggested ? 'accepted' : 'edited',
              editedText: text,
            })
          }
        >
          {text === s.suggested ? 'Accept' : 'Accept edited revision'}
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            run('decideSuggestion', { id: s.id, decision: 'rejected' })
          }
        >
          Reject
        </Button>
      </div>
      <Notice text={notice} />
    </div>
  );
}
