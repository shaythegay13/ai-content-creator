'use client';
import Link from 'next/link';
import type { Workspace } from '@/services/workspace';
import { Title } from './shared';
export function Search({ data, query }: { data: Workspace; query: string }) {
  const q = query.trim().toLowerCase();
  const groups = [
    {
      title: 'Posts',
      rows: data.posts
        .filter((p) =>
          `${p.title} ${p.coreIdea} ${data.variants
            .filter((v) => v.postId === p.id)
            .map((v) => v.body)
            .join(' ')}`
            .toLowerCase()
            .includes(q),
        )
        .map((p) => ({ id: p.id, title: p.title, url: `/posts/${p.id}` })),
    },
    {
      title: 'Ideas',
      rows: data.ideas
        .filter((i) =>
          `${i.title} ${i.rawNote} ${i.tags}`.toLowerCase().includes(q),
        )
        .map((i) => ({ ...i, url: '/ideas' })),
    },
    {
      title: 'Media',
      rows: data.media
        .filter((m) =>
          `${m.filename} ${m.description} ${m.tags}`.toLowerCase().includes(q),
        )
        .map((m) => ({ id: m.id, title: m.filename, url: '/media' })),
    },
    {
      title: 'Intelligence',
      rows: data.intelligence
        .filter((i) =>
          `${i.title} ${i.summary} ${i.rawText}`.toLowerCase().includes(q),
        )
        .map((i) => ({ ...i, url: '/intelligence' })),
    },
    {
      title: 'Trends',
      rows: data.trends
        .filter((t) => `${t.title} ${t.summary}`.toLowerCase().includes(q))
        .map((t) => ({ ...t, url: '/trends' })),
    },
  ];
  return (
    <>
      <Title
        title="Search"
        description={
          q
            ? `Workspace results for “${query}”`
            : 'Search ideas, posts, media, intelligence and trends.'
        }
      />
      <div className="column-stack">
        {groups.map((g) => (
          <section className="panel" key={g.title}>
            <h2>
              {g.title} · {q ? g.rows.length : 0}
            </h2>
            {q &&
              g.rows.map((row) => (
                <Link key={row.id} className="search-result" href={row.url}>
                  {row.title} →
                </Link>
              ))}
          </section>
        ))}
      </div>
    </>
  );
}
