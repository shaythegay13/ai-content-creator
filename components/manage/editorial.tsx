'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { Workspace } from '@/services/workspace';
import { Title, Field, Button, Notice, useManage, safeLink } from './shared';
export function Review({ data }: { data: Workspace }) {
  const reviews = [...data.reviews].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const [selected, setSelected] = useState('');
  const review = reviews.find((r) => r.id === selected) || reviews[0];
  const { run, busy, notice } = useManage();
  const items = data.postReviews.filter((r) => r.reviewId === review?.id);
  return (
    <>
      <Title
        title="Morning Review"
        description="Review the evidence. Keep your voice. Decide what changes."
      >
        <Button
          disabled={busy}
          onClick={() => run('sync', {}, () => setSelected(''))}
        >
          {busy ? 'Reviewing…' : 'Sync intelligence & review'}
        </Button>
      </Title>
      <Notice text={notice} />
      <div className="review-summary">
        <div>
          <strong>
            {Number(
              (review?.context as Record<string, unknown>)?.intelligenceCount ||
                data.intelligence.length,
            )}
          </strong>
          <span>Intelligence items</span>
        </div>
        <div>
          <strong>{items.filter((i) => i.variantId).length}</strong>
          <span>Posts reviewed</span>
        </div>
        <div>
          <strong>
            {items.filter((i) => i.recommendation === 'KEEP').length}
          </strong>
          <span>Keep</span>
        </div>
        <div>
          <strong>
            {
              items.filter((i) => i.variantId && i.recommendation !== 'KEEP')
                .length
            }
          </strong>
          <span>Suggested changes</span>
        </div>
      </div>
      <div className="filter-bar">
        <Field label="Review history">
          <select
            value={review?.id || ''}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Select a review</option>
            {reviews.map((r) => (
              <option key={r.id} value={r.id}>
                {r.reviewDate} · {new Date(r.createdAt).toLocaleTimeString()} ·{' '}
                {
                  data.postReviews.filter(
                    (p) => p.reviewId === r.id && p.variantId,
                  ).length
                }{' '}
                posts · {r.status}
              </option>
            ))}
          </select>
        </Field>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => run('review', {}, () => setSelected(''))}
        >
          Review current drafts
        </Button>
      </div>
      <p className="notice">
        {review?.mock
          ? 'Mock analysis uses deterministic examples; it is not a factual news assessment.'
          : 'Recommendations use only imported evidence. Review source links before accepting.'}{' '}
        Original text stays unchanged until you accept a revision.
      </p>
      {!items.length ? (
        <section className="panel">
          {review
            ? 'No scheduled posts were found for this review. The empty-day history is preserved.'
            : 'Run your first review to compare today’s schedule with the latest intelligence.'}
        </section>
      ) : (
        <div className="column-stack">
          {items.map((r) => (
            <ReviewCard key={r.id} review={r} data={data} />
          ))}
        </div>
      )}
      <section className="panel mt-6">
        <h2>Decision history</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Recommendations</th>
                <th>Accepted / edited</th>
                <th>Rejected / ignored</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => {
                const ids = data.postReviews
                  .filter((p) => p.reviewId === r.id)
                  .map((p) => p.id);
                const decisions = data.decisions.filter((d) =>
                  ids.includes(d.postReviewId),
                );
                return (
                  <tr key={r.id}>
                    <td>{r.reviewDate}</td>
                    <td>{ids.length}</td>
                    <td>
                      {
                        decisions.filter((d) =>
                          ['accepted', 'edited'].includes(d.decision),
                        ).length
                      }
                    </td>
                    <td>
                      {
                        decisions.filter((d) =>
                          ['rejected', 'ignored'].includes(d.decision),
                        ).length
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
function ReviewCard({
  review: r,
  data,
}: {
  review: Workspace['postReviews'][number];
  data: Workspace;
}) {
  const { run, busy, notice } = useManage();
  const [text, setText] = useState(r.suggestedRevision || '');
  const v = data.variants.find((v) => v.id === r.variantId);
  const post = data.posts.find((p) => p.id === v?.postId);
  const entry = data.calendar.find((c) => c.variantId === v?.id);
  const evidence = (r.evidenceSnapshot || []) as {
    id: string;
    title: string;
    summary: string;
    sourceUrl?: string;
    notionUrl?: string;
  }[];
  const latest = data.decisions.find((d) => d.postReviewId === r.id);
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            {v?.platform || 'New content opportunity'}{' '}
            {entry ? new Date(entry.scheduledAt).toLocaleString() : ''}
          </p>
          <h2>
            {post?.title || evidence[0]?.title || 'Consider an additional post'}
          </h2>
        </div>
        <span className="badge">{r.recommendation.replaceAll('_', ' ')}</span>
      </div>
      <h3>Why</h3>
      <ul className="evidence-list">
        {r.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <div className="two-column mt-5">
        <div>
          <p className="tiny-label">ORIGINAL</p>
          <p className="preserve">
            {r.originalText || 'This is an additional-post opportunity.'}
          </p>
        </div>
        {r.suggestedRevision && (
          <Field label="SUGGESTED REVISION — edit before accepting">
            <textarea
              rows={9}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
        )}
      </div>
      <h3 className="mt-5">Supporting intelligence</h3>
      {evidence.length ? (
        evidence.map((i) => (
          <div className="evidence-card" key={i.id}>
            <strong>{i.title}</strong>
            <p>{i.summary}</p>
            <div className="button-row">
              {safeLink(i.sourceUrl) && (
                <a
                  href={safeLink(i.sourceUrl)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Source ↗
                </a>
              )}
              {safeLink(i.notionUrl) && (
                <a
                  href={safeLink(i.notionUrl)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Notion ↗
                </a>
              )}
            </div>
          </div>
        ))
      ) : (
        <p className="muted">Insufficient related evidence was available.</p>
      )}
      <div className="button-row mt-5">
        {r.suggestedRevision && (
          <Button
            disabled={busy || Boolean(latest)}
            onClick={() =>
              run('decideReview', {
                id: r.id,
                decision: text === r.suggestedRevision ? 'accepted' : 'edited',
                editedText: text,
              })
            }
          >
            {text === r.suggestedRevision
              ? 'Accept revision'
              : 'Accept edited revision'}
          </Button>
        )}
        {r.variantId ? (
          <Button
            disabled={busy || Boolean(latest)}
            variant="outline"
            onClick={() =>
              run('decideReview', {
                id: r.id,
                decision: r.recommendation === 'KEEP' ? 'accepted' : 'rejected',
              })
            }
          >
            Keep original
          </Button>
        ) : (
          evidence[0] && (
            <Button
              disabled={busy}
              onClick={() =>
                run('saveIdea', {
                  title: evidence[0].title,
                  rawNote: evidence[0].summary,
                  source: 'notion',
                })
              }
            >
              Create idea
            </Button>
          )
        )}
        <Button
          variant="ghost"
          disabled={busy || Boolean(latest)}
          onClick={() => run('decideReview', { id: r.id, decision: 'ignored' })}
        >
          Ignore
        </Button>
        {post && <Link href={`/posts/${post.id}`}>Open post →</Link>}
      </div>
      <p className="muted text-xs mt-4">
        Decision: {latest?.decision || 'Awaiting your review'}
      </p>
      <Notice text={notice} />
    </section>
  );
}
export function Opportunities({ data }: { data: Workspace }) {
  const { run, busy, notice } = useManage();
  const [state, setState] = useState('new');
  return (
    <>
      <Title
        title="Content opportunities"
        description="Turn important intelligence into a useful next post."
      />
      <div className="filter-bar">
        <select
          aria-label="Opportunity status"
          value={state}
          onChange={(e) => setState(e.target.value)}
        >
          {['new', 'saved', 'used', 'dismissed', 'all'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => run('sync', {})}
        >
          Find opportunities from intelligence
        </Button>
      </div>
      <Notice text={notice} />
      <div className="column-stack">
        {data.opportunities
          .filter((o) => state === 'all' || o.state === state)
          .map((o) => {
            const i = data.intelligence.find((i) => i.id === o.intelligenceId);
            return (
              <section className="panel" key={o.id}>
                <h2>{o.title}</h2>
                <p className="muted my-4">{o.reason}</p>
                <p className="preserve">{i?.summary}</p>
                <div className="button-row mt-5">
                  {[
                    ['idea', 'Create idea'],
                    ['x', 'Draft X post'],
                    ['linkedin', 'Draft LinkedIn post'],
                    ['later', 'Save for later'],
                    ['dismiss', 'Dismiss'],
                  ].map(([mode, label]) => (
                    <Button
                      key={mode}
                      size="sm"
                      variant={mode === 'idea' ? 'default' : 'outline'}
                      disabled={busy}
                      onClick={() => run('opportunity', { id: o.id, mode })}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                {safeLink(i?.sourceUrl) && (
                  <a
                    className="quiet-link mt-4"
                    href={safeLink(i?.sourceUrl)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Supporting source ↗
                  </a>
                )}
              </section>
            );
          })}
      </div>
      <section className="panel mt-6">
        <h2>Trend signals</h2>
        {data.trends.map((t) => (
          <article className="opportunity" key={t.id}>
            <div>
              <h3>{t.title}</h3>
              <p>{t.summary}</p>
              <Button
                className="mt-3"
                size="sm"
                variant="outline"
                onClick={() =>
                  run('saveIdea', {
                    title: t.title,
                    rawNote: t.summary,
                    source: 'trend',
                  })
                }
              >
                Save as idea
              </Button>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
