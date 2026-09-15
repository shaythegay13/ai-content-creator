'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { Workspace } from '@/services/workspace';
import { zonedInput } from '@/lib/time';
import { Title, Button, Notice, useManage } from './shared';
export function Calendar({ data, zone }: { data: Workspace; zone: string }) {
  const [view, setView] = useState('month');
  const [anchor, setAnchor] = useState(
    zonedInput(new Date(), zone).slice(0, 10),
  );
  const { run, busy, notice } = useManage();
  const date = new Date(anchor + 'T12:00:00Z');
  const year = date.getUTCFullYear(),
    month = date.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const start =
    view === 'week'
      ? new Date(date.getTime() - date.getUTCDay() * 86400000)
      : new Date(first.getTime() - first.getUTCDay() * 86400000);
  const days = Array.from({ length: view === 'week' ? 7 : 42 }, (_, i) =>
    new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10),
  );
  const entries = data.calendar
    .map((c) => ({
      ...c,
      local: zonedInput(c.scheduledAt, zone),
      variant: data.variants.find((v) => v.id === c.variantId)!,
    }))
    .filter((c) => c.variant)
    .sort((a, b) => a.local.localeCompare(b.local));
  function move(n: number) {
    date.setUTCDate(date.getUTCDate() + n * (view === 'week' ? 7 : 28));
    setAnchor(date.toISOString().slice(0, 10));
  }
  function card(entry: (typeof entries)[number]) {
    const post = data.posts.find((p) => p.id === entry.variant.postId);
    return (
      <Link
        draggable
        onDragStart={(e) => e.dataTransfer.setData('text/plain', entry.id)}
        className={`calendar-event ${entry.variant.platform}`}
        href={`/posts/${entry.variant.postId}`}
        key={entry.id}
      >
        <span>
          {entry.local.slice(11)} · {entry.variant.platform} ·{' '}
          {entry.variant.status}
        </span>
        <strong>{post?.title || entry.variant.body.slice(0, 60)}</strong>
        <small>
          {data.postMedia.some((m) => m.postId === post?.id) ? '▧ Media ' : ''}
          {data.postReviews.some((r) => r.variantId === entry.variantId)
            ? '◉ Review'
            : ''}
        </small>
      </Link>
    );
  }
  return (
    <>
      <Title
        title="Calendar"
        description={`Plan each platform separately · ${zone} · Drag an entry to another day`}
      >
        <Link href="/create">+ New post</Link>
      </Title>
      <div className="panel">
        <div className="calendar-toolbar">
          <div className="button-row">
            {['month', 'week', 'agenda'].map((v) => (
              <Button
                key={v}
                variant={view === v ? 'default' : 'outline'}
                onClick={() => setView(v)}
              >
                {v}
              </Button>
            ))}
          </div>
          <div className="button-row">
            <Button variant="outline" onClick={() => move(-1)}>
              ←
            </Button>
            <input
              aria-label="Calendar date"
              type="date"
              value={anchor}
              onChange={(e) => setAnchor(e.target.value)}
            />
            <Button variant="outline" onClick={() => move(1)}>
              →
            </Button>
          </div>
        </div>
        <h2 className="my-5">
          {date.toLocaleDateString('en-US', {
            timeZone: 'UTC',
            month: 'long',
            year: 'numeric',
          })}
        </h2>
        {view === 'agenda' ? (
          <div className="agenda-list">
            {entries.length ? (
              entries.map((c) => (
                <div key={c.id}>
                  <p className="tiny-label">{c.local.slice(0, 10)}</p>
                  {card(c)}
                </div>
              ))
            ) : (
              <p>No scheduled posts yet.</p>
            )}
          </div>
        ) : (
          <div className="calendar-scroll">
            <div className="calendar-grid">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div className="weekday" key={d}>
                  {d}
                </div>
              ))}
              {days.map((day) => (
                <div
                  className={`calendar-cell ${day.slice(5, 7) !== anchor.slice(5, 7) ? 'outside-month' : ''}`}
                  key={day}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const entry = entries.find(
                      (c) => c.id === e.dataTransfer.getData('text/plain'),
                    );
                    if (entry && !busy)
                      run('schedule', {
                        variantId: entry.variantId,
                        localTime: `${day}T${entry.local.slice(11)}`,
                        timezone: zone,
                      });
                  }}
                >
                  <div className="day-header">
                    <strong>{Number(day.slice(8))}</strong>
                    <Link
                      aria-label={`Create on ${day}`}
                      href={`/create?date=${day}`}
                    >
                      +
                    </Link>
                  </div>
                  {entries.filter((c) => c.local.startsWith(day)).map(card)}
                </div>
              ))}
            </div>
          </div>
        )}
        <Notice text={notice} />
      </div>
    </>
  );
}
