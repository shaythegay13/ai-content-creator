'use client';
import { useState } from 'react';
import { DraftExplanation } from './draft-explanation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Workspace } from '@/services/workspace';
import { zonedInput } from '@/lib/time';
import {
  validatePlatform,
  hashtagsIn,
  withoutHashtags,
  composePost,
} from '@/lib/platform-validation';
import { Button, Field, Title, Notice, useManage } from './shared';
const actions = [
  'Try Different Angle',
  'Make More Insightful',
  'Make More Personal',
  'Make More Industry-Focused',
  'Use Current Intelligence',
  'Use a Founder-Lesson Angle',
  'Make More Contrarian',
  'Make More Educational',
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
  const [platforms, setPlatforms] = useState(['x', 'linkedin']);
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
          const r = await run('createContent', {
            title: f.get('title'),
            coreIdea: f.get('body'),
            platforms,
          });
          if (r.ok) {
            const post = r.data as { id: string };
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
        <PlatformTargets value={platforms} onChange={setPlatforms} />
        <Button disabled={busy || !platforms.length}>
          Create draft with X + LinkedIn variants
        </Button>
        {busy && (
          <p role="status">
            Understanding notes, choosing angles, and reviewing platform drafts.
            This may wait for your AI rate limit.
          </p>
        )}
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
            <Button
              disabled={busy}
              onClick={() => run('regenerateAll', { id })}
            >
              Regenerate all (proposals)
            </Button>
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
                    run('generateVariant', {
                      postId: id,
                      platform,
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
  const [tagText, setTagText] = useState(hashtagsIn(v.body).join(', '));
  const [savedBody, setSavedBody] = useState(v.body);
  if (savedBody !== v.body) {
    setSavedBody(v.body);
    setBody(v.body);
    setTagText(hashtagsIn(v.body).join(', '));
  }
  const [action, setAction] = useState(actions[0]);
  const [extra, setExtra] = useState('');
  const entry = data.calendar.find((c) => c.variantId === v.id);
  const pending = data.suggestions.filter(
    (s) => s.variantId === v.id && s.state === 'pending',
  );
  const validation = validatePlatform(v.platform, body);
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
          onChange={(e) => {
            setBody(e.target.value);
            setTagText(hashtagsIn(e.target.value).join(', '));
          }}
        />
      </Field>
      <DraftExplanation data={data} postId={v.postId} platform={v.platform} />
      <Field label={`${v.platform} hashtags`}>
        <input
          value={tagText}
          onChange={(e) => {
            setTagText(e.target.value);
            setBody(
              composePost(
                withoutHashtags(body),
                e.target.value
                  .split(/[\s,]+/)
                  .map((t) => t.replace(/^#/, ''))
                  .filter(Boolean),
              ),
            );
          }}
        />
      </Field>
      <p className={validation.valid ? 'muted' : 'warning-text'}>
        <strong>
          {validation.count} / {validation.limit}
        </strong>
        {!validation.valid &&
          ' — Invalid: shorten before saving, approving or scheduling.'}
      </p>
      <p role={v.generationStatus === 'failed' ? 'alert' : undefined}>
        Initial generation:{' '}
        {v.generationStatus === 'succeeded' ? 'Complete' : v.generationStatus}
        {v.generationError ? ` — ${v.generationError}` : ''}
      </p>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() =>
          run('generateVariant', {
            postId: v.postId,
            platform: v.platform,
            regenerate: !!v.body.trim(),
          })
        }
      >
        {busy
          ? 'Generating…'
          : v.generationStatus === 'failed'
            ? 'Retry ' + v.platform + ' generation'
            : v.body.trim()
              ? 'Regenerate ' + v.platform
              : 'Generate ' + v.platform + ' draft'}
      </Button>

      <div className="button-row">
        <Button
          disabled={busy || !validation.valid}
          onClick={() => run('saveVariant', { ...v, body })}
        >
          Save {v.platform} text
        </Button>
        <Button
          variant="outline"
          disabled={busy || !validation.valid}
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
        <Button disabled={busy || !validation.valid}>
          Schedule {v.platform}
        </Button>
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
        <Suggestion key={s.id} suggestion={s} platform={v.platform} />
      ))}
      <Notice text={notice} />
    </section>
  );
}
function Suggestion({
  suggestion: s,
  platform,
}: {
  suggestion: Workspace['suggestions'][number];
  platform: string;
}) {
  const { run, busy, notice } = useManage();
  const [text, setText] = useState(s.suggested);
  const validation = validatePlatform(platform, text);
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
        <p className={validation.valid ? 'muted' : 'warning-text'}>
          {validation.count} / {validation.limit}
        </p>
        <Button
          disabled={busy || !validation.valid}
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
export function PlatformTargets({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <fieldset className="button-row">
      <legend>Target platforms</legend>
      {['x', 'linkedin'].map((p) => (
        <label key={p}>
          <input
            type="checkbox"
            checked={value.includes(p)}
            onChange={(e) =>
              onChange(
                e.target.checked ? [...value, p] : value.filter((v) => v !== p),
              )
            }
          />
          {p === 'x' ? 'X' : 'LinkedIn'}
        </label>
      ))}
    </fieldset>
  );
}
