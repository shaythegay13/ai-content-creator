import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  FileText,
  Lightbulb,
  Radio,
  Sun,
  TrendingUp,
  Image as ImageIcon,
  Video,
  AudioLines,
  Check,
  Layers,
  Plus,
} from 'lucide-react';
import type { Workspace } from '@/services/workspace';
import { timezone } from '@/lib/config';
import { dayKey } from '@/services/editorial';
import { Button } from './ui/button';
import { CreateForm, UploadForm, ProfileForm, ChatForm } from './forms';
import { runReview, syncIntelligence, recordDecision } from '@/app/actions';
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
function Platform({ platform }: { platform: string }) {
  return (
    <span className={`platform platform-${platform}`}>
      {platform === 'linkedin'
        ? 'in'
        : platform === 'x'
          ? '𝕏'
          : platform.slice(0, 2)}
    </span>
  );
}
function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
function Panel({
  title,
  subtitle,
  href,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  href?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="quiet-link">
            View all <ArrowUpRight size={14} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="empty-state">{children}</p>;
}
function PostCards({
  data,
  scheduledOnly = false,
}: {
  data: Workspace;
  scheduledOnly?: boolean;
}) {
  const entries = data.calendar.filter(
    (c) => dayKey(c.scheduledAt, timezone()) === dayKey(new Date(), timezone()),
  );
  const variants = scheduledOnly
    ? entries
        .map((c) => data.variants.find((v) => v.id === c.variantId)!)
        .filter(Boolean)
    : data.variants;
  return (
    <div className="post-list">
      {variants.length ? (
        variants.map((v) => {
          const post = data.posts.find((p) => p.id === v.postId);
          const entry = data.calendar.find((c) => c.variantId === v.id);
          return (
            <Link href={`/posts/${post?.id}`} className="post-row" key={v.id}>
              <div className="post-row-top">
                <Platform platform={v.platform} />
                <strong>
                  {v.platform === 'x'
                    ? 'X / Twitter'
                    : v.platform === 'linkedin'
                      ? 'LinkedIn'
                      : v.platform}
                </strong>
                <Badge tone={v.status === 'scheduled' ? 'green' : 'neutral'}>
                  {v.status}
                </Badge>
                {entry && (
                  <span className="post-time">
                    <Clock3 size={12} />
                    {new Intl.DateTimeFormat('en-US', {
                      timeZone: timezone(),
                      hour: 'numeric',
                      minute: '2-digit',
                    }).format(entry.scheduledAt)}
                  </span>
                )}
              </div>
              <h3>{post?.title}</h3>
              <p>{v.body}</p>
              <div className="post-row-bottom">
                <span>Founder perspective</span>
                <ArrowUpRight size={15} />
              </div>
            </Link>
          );
        })
      ) : (
        <Empty>No posts scheduled for today. Your calendar is clear.</Empty>
      )}
    </div>
  );
}
function IntelligenceList({ data }: { data: Workspace }) {
  return (
    <div>
      {data.intelligence.map((item, index) => (
        <article key={item.id} className="intel-row">
          <span className={`intel-icon intel-icon-${index % 3}`}>
            <Radio size={16} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="tiny-label">
                {item.category.replaceAll('_', ' ')}
              </span>
              {item.importance === 3 && <span className="priority-dot" />}
            </div>
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
            <span className="source-label">
              {item.source === 'mock-notion'
                ? 'Notion daily brief · Sample'
                : item.source}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
function MediaGrid({ data, limit }: { data: Workspace; limit?: number }) {
  return (
    <div className="media-grid">
      {data.media.slice(0, limit).map((m, i) => (
        <article className="media-card" key={m.id}>
          <div className={`media-preview media-preview-${i % 3}`}>
            {m.kind === 'video' ? (
              <Video size={28} />
            ) : m.kind === 'audio' ? (
              <AudioLines size={28} />
            ) : (
              <ImageIcon size={28} />
            )}
            <span>{m.kind.toUpperCase()}</span>
          </div>
          <h3>{m.filename}</h3>
          <p>
            {(m.size / 1000000).toFixed(1)} MB · {m.usageStatus}
          </p>
          {m.storageProvider === 'mock' ? (
            <small>Metadata example</small>
          ) : (
            <a
              href={`/api/media/${m.id}`}
              target="_blank"
              rel="noreferrer"
              className="quiet-link"
            >
              Open uploaded file <ArrowUpRight size={12} />
            </a>
          )}
        </article>
      ))}
    </div>
  );
}
function Opportunities({ data }: { data: Workspace }) {
  if (data.opportunities.some((o) => o.state === 'new'))
    return (
      <div>
        {data.opportunities
          .filter((o) => o.state === 'new')
          .slice(0, 3)
          .map((o) => (
            <article className="opportunity" key={o.id}>
              <div>
                <h3>{o.title}</h3>
                <p>{o.reason}</p>
                <Link href="/trends" className="quiet-link">
                  Explore opportunity →
                </Link>
              </div>
            </article>
          ))}
      </div>
    );
  return (
    <div>
      {data.trends.map((trend, i) => (
        <article className="opportunity" key={trend.id}>
          <span className="opportunity-number">0{i + 1}</span>
          <div>
            <h3>{trend.title}</h3>
            <p>{trend.summary}</p>
            <span className="trend-score">
              <TrendingUp size={13} /> {trend.score} opportunity score · sample
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
export function Dashboard({ data }: { data: Workspace }) {
  const scheduled = data.calendar.filter(
    (c) => dayKey(c.scheduledAt, timezone()) === dayKey(new Date(), timezone()),
  );
  const todayReview = data.reviews.find(
    (r) => r.reviewDate === dayKey(new Date(), timezone()),
  );
  const impressions = data.metrics.reduce((sum, m) => sum + m.impressions, 0);
  return (
    <>
      <Heading
        eyebrow={new Intl.DateTimeFormat('en-US', {
          timeZone: timezone(),
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })
          .format(new Date())
          .toUpperCase()}
        title="A little clarity. Then create."
        description="Your content, context, and next good idea — all in one place."
        action={
          <Button asChild variant="outline">
            <Link href="/calendar">
              <CalendarDays size={16} />
              View calendar
            </Link>
          </Button>
        }
      />
      <section className="morning-banner">
        <div className="sun-emblem">
          <Sun size={27} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2>Your morning, in perspective</h2>
            <Badge tone="green">
              {todayReview ? 'Review prepared' : 'Ready when you are'}
            </Badge>
          </div>
          <p>
            {scheduled.length} posts on today’s calendar. Review your latest
            intelligence before they go out.
          </p>
        </div>
        <Button asChild>
          <Link href="/morning-review">
            Open morning review
            <ArrowRight size={16} />
          </Link>
        </Button>
      </section>
      <div className="stat-grid">
        {[
          {
            name: 'Ideas in the pipeline',
            value: data.ideas.length,
            detail: 'A place for your next thought',
            icon: Lightbulb,
          },
          {
            name: 'Drafts taking shape',
            value: data.posts.filter((p) => p.status === 'draft').length,
            detail: 'Keep the momentum going',
            icon: FileText,
          },
          {
            name: 'Ready to share',
            value: data.posts.filter((p) => p.status === 'ready').length,
            detail: 'Your next publishing queue',
            icon: Check,
          },
          {
            name: 'Scheduled concepts',
            value: data.posts.filter((p) => p.status === 'scheduled').length,
            detail: `${scheduled.length} platform posts today`,
            icon: CalendarDays,
          },
        ].map((stat) => (
          <div className="stat-card" key={stat.name}>
            <div>
              <span>{stat.name}</span>
              <stat.icon size={17} />
            </div>
            <strong>{String(stat.value).padStart(2, '0')}</strong>
            <p>{stat.detail}</p>
          </div>
        ))}
      </div>
      <div className="dashboard-columns">
        <div className="column-stack">
          <Panel
            title="On the calendar today"
            subtitle="Thoughtful content. A little room to breathe."
            href="/calendar"
          >
            <PostCards data={data} scheduledOnly />
          </Panel>
          <Panel
            title="Your intelligence briefing"
            subtitle="A little context for better content."
            href="/intelligence"
          >
            <IntelligenceList data={data} />
          </Panel>
          <Panel
            title="Ready for a story"
            subtitle="Recent unused media from your library."
            href="/media"
          >
            <MediaGrid
              data={{
                ...data,
                media: data.media.filter((m) => m.usageStatus === 'unused'),
              }}
              limit={3}
            />
          </Panel>
        </div>
        <div className="column-stack">
          <Panel
            title="Worth exploring"
            subtitle="Signals to turn into your next idea."
            href="/trends"
          >
            <Opportunities data={data} />
          </Panel>
          <Panel title="Content at a glance" href="/analytics">
            <div className="performance-total">
              <strong>{(impressions / 1000).toFixed(1)}k</strong>
              <span>sample impressions</span>
              <Badge tone="green">Historical fixtures</Badge>
            </div>
            <div
              className="chart-bars"
              aria-label="Decorative sample performance chart"
            >
              {[25, 38, 31, 55, 44, 70, 58, 88, 72, 100, 83, 95].map(
                (height, i) => (
                  <span key={i} style={{ height: `${height}%` }} />
                ),
              )}
            </div>
            <div className="chart-labels">
              <span>Sample history</span>
              <span>Latest</span>
            </div>
            <div className="metric-bottom">
              <span>
                <strong>{data.metrics.reduce((a, m) => a + m.likes, 0)}</strong>{' '}
                likes
              </span>
              <span>
                <strong>
                  {data.metrics.reduce((a, m) => a + m.comments, 0)}
                </strong>{' '}
                comments
              </span>
            </div>
          </Panel>
          <Panel
            title="A nudge from your assistant"
            className="recommendation-panel"
          >
            <div className="assistant-emblem">
              <Layers size={20} />
            </div>
            <h3>
              {data.postReviews[0]?.recommendation.replaceAll('_', ' ') ||
                data.recommendations[0]?.title}
            </h3>
            <p>
              {data.postReviews[0]?.reasons.join(' ') ||
                data.recommendations[0]?.reason}
            </p>
            <Link href="/assistant" className="quiet-link">
              Explore with assistant <ArrowRight size={14} />
            </Link>
          </Panel>
          <div className="approval-note">
            <Check size={15} />
            <span>
              Your voice. Your final say.
              <br />
              AI changes always need your approval.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
export function WorkspacePage({
  section,
  data,
  query = '',
}: {
  section: string;
  data: Workspace;
  query?: string;
}) {
  if (section === 'create')
    return (
      <>
        <Heading
          eyebrow="MAKE SPACE FOR AN IDEA"
          title="Create something worth sharing"
          description="Start with the concept. Shape each platform variant from there."
        />
        <div className="narrow">
          <Panel title="New content">
            <CreateForm />
          </Panel>
        </div>
      </>
    );
  if (section === 'ideas')
    return (
      <>
        <Heading
          eyebrow="CONTENT PIPELINE"
          title="Ideas"
          description="Catch the thought before it gets away."
          action={
            <Button asChild>
              <Link href="/create">
                <Plus size={16} />
                New idea
              </Link>
            </Button>
          }
        />
        <div className="split-layout">
          <Panel
            title="Your idea inbox"
            subtitle={`${data.ideas.length} ideas, waiting for their moment`}
          >
            <div className="idea-list">
              {data.ideas.map((idea) => (
                <article key={idea.id}>
                  <div className="flex justify-between gap-3">
                    <h3>{idea.title}</h3>
                    <Badge tone={idea.priority === 3 ? 'amber' : 'neutral'}>
                      {idea.priority === 3 ? 'High priority' : 'Normal'}
                    </Badge>
                  </div>
                  <p>{idea.rawNote}</p>
                  <div className="flex flex-wrap gap-2">
                    {idea.tags.map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                    <span className="source-label">From {idea.source}</span>
                  </div>
                </article>
              ))}
            </div>
          </Panel>
          <Panel title="Quick capture">
            <CreateForm kind="idea" />
          </Panel>
        </div>
      </>
    );
  if (section === 'posts')
    return (
      <>
        <Heading
          eyebrow="YOUR CONTENT"
          title="Posts"
          description="One core idea. A distinct voice for each platform."
          action={
            <Button asChild>
              <Link href="/create">
                <Plus size={16} />
                New post
              </Link>
            </Button>
          }
        />
        <Panel
          title="Content library"
          subtitle={`${data.posts.length} concepts · ${data.variants.length} linked variants`}
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Content concept</th>
                  <th>Platforms</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.posts.map((post) => (
                  <tr key={post.id}>
                    <td>
                      <Link href={`/posts/${post.id}`} className="table-title">
                        {post.title}
                        <ArrowUpRight size={14} />
                      </Link>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        {data.variants
                          .filter((v) => v.postId === post.id)
                          .map((v) => (
                            <Platform key={v.id} platform={v.platform} />
                          ))}
                      </div>
                    </td>
                    <td>
                      <Badge
                        tone={post.status === 'scheduled' ? 'green' : 'neutral'}
                      >
                        {post.status}
                      </Badge>
                    </td>
                    <td>
                      {post.updatedAt.toLocaleDateString('en-US', {
                        timeZone: timezone(),
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </>
    );
  if (section === 'calendar') {
    const ordered = [...data.calendar].sort(
      (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime(),
    );
    return (
      <>
        <Heading
          eyebrow="YOUR PUBLISHING RHYTHM"
          title="Calendar"
          description={`Scheduled platform variants · ${timezone()}`}
          action={
            <Button asChild variant="outline">
              <Link href="/create">Create a draft</Link>
            </Button>
          }
        />
        <Panel
          title="Upcoming schedule"
          subtitle="Foundation preview · no automatic publishing"
        >
          {ordered.map((entry) => {
            const variant = data.variants.find((v) => v.id === entry.variantId);
            const post = data.posts.find((p) => p.id === variant?.postId);
            return (
              <div className="calendar-row" key={entry.id}>
                <div className="calendar-date">
                  <strong>
                    {entry.scheduledAt.toLocaleDateString('en-US', {
                      timeZone: timezone(),
                      day: '2-digit',
                    })}
                  </strong>
                  <span>
                    {entry.scheduledAt.toLocaleDateString('en-US', {
                      timeZone: timezone(),
                      month: 'short',
                    })}
                  </span>
                </div>
                <div>
                  <span className="tiny-label">
                    {entry.scheduledAt.toLocaleTimeString('en-US', {
                      timeZone: timezone(),
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                  <h3>
                    <Link href={`/posts/${post?.id}`}>{post?.title}</Link>
                  </h3>
                  <p>{variant?.body.slice(0, 130)}…</p>
                </div>
                <Platform platform={variant?.platform || 'x'} />
                <Badge tone="green">{variant?.status}</Badge>
              </div>
            );
          })}
          {!ordered.length && <Empty>No scheduled posts yet.</Empty>}
        </Panel>
      </>
    );
  }
  if (section === 'media')
    return (
      <>
        <Heading
          eyebrow="YOUR ASSET LIBRARY"
          title="Media"
          description="A home for the moments behind your content."
        />
        <div className="split-layout">
          <Panel
            title="Your media"
            subtitle="Search filenames, descriptions and tags using global search."
          >
            <MediaGrid data={data} />
          </Panel>
          <Panel title="Add to your library">
            <UploadForm />
          </Panel>
        </div>
      </>
    );
  if (section === 'intelligence')
    return (
      <>
        <Heading
          eyebrow="CONTEXT BEFORE CONTENT"
          title="Intelligence"
          description="Your daily brief, connected to the way you create."
          action={
            <form action={syncIntelligence}>
              <Button variant="outline">
                <Radio size={16} />
                Sync sample brief
              </Button>
            </form>
          }
        />
        <div className="notice">
          Sample Notion intelligence · These are fictional editorial fixtures,
          not verified news.
        </div>
        <Panel
          title="Latest intelligence"
          subtitle="Notion adapter boundary prepared for a later stage"
        >
          <IntelligenceList data={data} />
        </Panel>
      </>
    );
  if (section === 'trends')
    return (
      <>
        <Heading
          eyebrow="FIND YOUR NEXT ANGLE"
          title="Trends & opportunities"
          description="Interesting signals, filtered through your perspective."
        />
        <div className="notice">
          Seeded opportunities · No social monitoring or scraping is active.
        </div>
        <Panel title="Signals worth your attention">
          <Opportunities data={data} />
        </Panel>
      </>
    );
  if (section === 'analytics')
    return (
      <>
        <Heading
          eyebrow="LEARN FROM WHAT YOU SHARE"
          title="Performance"
          description="Make your next post a little more informed."
        />
        <div className="notice">
          Historical sample data · No live analytics provider is connected.
        </div>
        <Panel title="Post performance">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Impressions</th>
                  <th>Likes</th>
                  <th>Comments</th>
                  <th>Shares</th>
                </tr>
              </thead>
              <tbody>
                {data.metrics.map((metric) => {
                  const pub = data.published.find(
                    (p) => p.id === metric.publishedPostId,
                  );
                  const variant = data.variants.find(
                    (v) => v.id === pub?.variantId,
                  );
                  const post = data.posts.find((p) => p.id === variant?.postId);
                  return (
                    <tr key={metric.id}>
                      <td>{post?.title}</td>
                      <td>{metric.impressions.toLocaleString()}</td>
                      <td>{metric.likes}</td>
                      <td>{metric.comments}</td>
                      <td>{metric.shares}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </>
    );
  if (section === 'assistant')
    return (
      <>
        <Heading
          eyebrow="A THINKING PARTNER"
          title="AI Assistant"
          description="Work through an angle, find the story, or get unstuck."
        />
        <div className="narrow">
          <Panel
            title="Your content notebook"
            subtitle="Mock brainstorming · Messages are saved locally."
          >
            <div className="conversation">
              {data.messages.length ? (
                data.messages.map((m) => (
                  <article key={m.id} className={`message message-${m.role}`}>
                    <span className="tiny-label">
                      {m.role === 'user' ? 'You' : 'Mock assistant'}
                    </span>
                    <p>{m.content}</p>
                  </article>
                ))
              ) : (
                <Empty>
                  Bring a rough thought. Try “What did building our hackathon
                  prototype teach us?”
                </Empty>
              )}
            </div>
            <ChatForm />
          </Panel>
        </div>
      </>
    );
  if (section === 'settings')
    return (
      <>
        <Heading
          eyebrow="MAKE IT YOURS"
          title="Settings"
          description="Your voice and the way your workspace works."
        />
        <div className="split-layout">
          <Panel
            title="Writing profile"
            subtitle="The starting point for your future AI content assistant"
          >
            <ProfileForm
              tone={data.profile?.tone || ''}
              instructions={data.profile?.personalInstructions || ''}
            />
            <div className="settings-details">
              <p>
                <strong>Sentence style</strong>
                {data.profile?.sentenceStyle}
              </p>
              <p>
                <strong>Formatting</strong>
                {data.profile?.formattingPreferences}
              </p>
              <p>
                <strong>Avoid</strong>
                {data.profile?.phrasesToAvoid?.join(', ')}
              </p>
              <p>
                <strong>Call to action</strong>
                {data.profile?.ctaStyle}
              </p>
            </div>
          </Panel>
          <Panel title="Workspace configuration">
            <div className="settings-details">
              <p>
                <strong>Environment</strong>Local development · single user
              </p>
              <p>
                <strong>Database</strong>Embedded PostgreSQL / Drizzle
              </p>
              <p>
                <strong>Media</strong>Local filesystem
              </p>
              <p>
                <strong>AI & intelligence</strong>Mock providers
              </p>
              <p>
                <strong>Publishing</strong>Simulation only
              </p>
              <p>
                <strong>Timezone</strong>
                {timezone()}
              </p>
              <p>
                <strong>Morning review</strong>Manually triggered
              </p>
            </div>
          </Panel>
        </div>
      </>
    );
  if (section === 'morning-review') {
    const review = data.reviews.find(
      (r) => r.reviewDate === dayKey(new Date(), timezone()),
    );
    const items = data.postReviews.filter((r) => r.reviewId === review?.id);
    return (
      <>
        <Heading
          eyebrow="YOUR DAILY EDITORIAL CHECK-IN"
          title="Morning Review"
          description="A pause to consider the context before your content goes out."
          action={
            <form action={runReview}>
              <Button>
                <Sun size={16} />
                {review ? 'Refresh sample review' : 'Prepare sample review'}
              </Button>
            </form>
          }
        />
        <div className="notice">
          Foundation workflow · Recommendations are deterministic samples, not
          AI analysis. Decisions are recorded without editing or publishing
          posts.
        </div>
        {!review ? (
          <Panel title="Ready when you are">
            <Empty>
              Prepare a sample review to collect today’s scheduled posts and
              supporting intelligence.
            </Empty>
          </Panel>
        ) : (
          <div className="column-stack">
            {items.length ? (
              items.map((item) => (
                <Panel key={item.id} title="Keep the planned perspective">
                  <div className="flex gap-2 mb-4">
                    <Badge tone="green">{item.recommendation}</Badge>
                    <Badge>Sample recommendation</Badge>
                  </div>
                  <blockquote>{item.originalText}</blockquote>
                  <h3 className="mt-5">Why this recommendation</h3>
                  {item.reasons.map((reason) => (
                    <p className="muted mt-2" key={reason}>
                      {reason}
                    </p>
                  ))}
                  <h3 className="mt-5">Supporting intelligence</h3>
                  <ul className="evidence-list">
                    {(
                      (item.evidenceSnapshot as {
                        id: string;
                        title: string;
                        summary: string;
                      }[]) || []
                    ).map((e) => (
                      <li key={e.id}>
                        <strong>{e.title}</strong>
                        <p>{e.summary}</p>
                      </li>
                    ))}
                  </ul>
                  <div className="decision-row">
                    {(['accepted', 'rejected', 'ignored'] as const).map(
                      (decision) => (
                        <form key={decision} action={recordDecision}>
                          <input type="hidden" name="id" value={item.id} />
                          <input
                            type="hidden"
                            name="decision"
                            value={decision}
                          />
                          <Button
                            variant={
                              decision === 'accepted' ? 'default' : 'outline'
                            }
                            size="sm"
                          >
                            {decision === 'accepted'
                              ? 'Accept recommendation'
                              : decision === 'rejected'
                                ? 'Reject'
                                : 'Ignore'}
                          </Button>
                        </form>
                      ),
                    )}
                  </div>
                  <p className="muted text-xs mt-3">
                    Latest decision:{' '}
                    {data.decisions.find((d) => d.postReviewId === item.id)
                      ?.decision || 'Awaiting your review'}
                  </p>
                </Panel>
              ))
            ) : (
              <Panel title="A clear calendar">
                <Empty>
                  No scheduled platform posts for today. The sample review has
                  been recorded.
                </Empty>
              </Panel>
            )}
          </div>
        )}
      </>
    );
  }
  if (section === 'search') {
    const q = query.trim().toLowerCase();
    const posts = q
      ? data.posts.filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            data.variants.some(
              (v) => v.postId === p.id && v.body.toLowerCase().includes(q),
            ),
        )
      : [];
    const ideas = q
      ? data.ideas.filter((i) =>
          `${i.title} ${i.rawNote} ${i.tags.join(' ')}`
            .toLowerCase()
            .includes(q),
        )
      : [];
    const media = q
      ? data.media.filter((m) =>
          `${m.filename} ${m.description} ${m.tags.join(' ')}`
            .toLowerCase()
            .includes(q),
        )
      : [];
    const intelligence = q
      ? data.intelligence.filter((i) =>
          `${i.title} ${i.summary}`.toLowerCase().includes(q),
        )
      : [];
    return (
      <>
        <Heading
          eyebrow="YOUR WORKSPACE, CONNECTED"
          title="Search"
          description={
            q
              ? `Results for “${query}”`
              : 'Enter a term in the search box above.'
          }
        />
        <div className="column-stack">
          <Panel title={`Posts · ${posts.length}`}>
            {posts.map((p) => (
              <Link
                className="search-result"
                href={`/posts/${p.id}`}
                key={p.id}
              >
                {p.title}
                <ArrowRight size={14} />
              </Link>
            ))}
          </Panel>
          <Panel title={`Ideas · ${ideas.length}`}>
            {ideas.map((i) => (
              <Link className="search-result" href="/ideas" key={i.id}>
                {i.title}
                <Lightbulb size={14} />
              </Link>
            ))}
          </Panel>
          <Panel title={`Media · ${media.length}`}>
            <MediaGrid data={{ ...data, media }} />
          </Panel>
          <Panel title={`Intelligence · ${intelligence.length}`}>
            <IntelligenceList data={{ ...data, intelligence }} />
          </Panel>
        </div>
      </>
    );
  }
  return null;
}
export function PostDetail({ data, id }: { data: Workspace; id: string }) {
  const post = data.posts.find((p) => p.id === id)!;
  return (
    <>
      <Heading
        eyebrow="CONTENT CONCEPT"
        title={post.title}
        description="Platform variants share the same underlying concept."
        action={<Badge tone="green">{post.status}</Badge>}
      />
      <div className="two-column">
        {data.variants
          .filter((v) => v.postId === id)
          .map((v) => (
            <Panel
              key={v.id}
              title={v.platform === 'x' ? 'X / Twitter' : 'LinkedIn'}
            >
              <div className="flex gap-3 mb-4">
                <Platform platform={v.platform} />
                <Badge>{v.status}</Badge>
              </div>
              <p className="whitespace-pre-wrap leading-7">{v.body}</p>
              <p className="muted text-xs mt-6">
                {v.body.length} characters · Foundation preview
              </p>
            </Panel>
          ))}
      </div>
      <div className="notice mt-6">
        Post editing, scheduling controls and real publishing are reserved for
        the next stage.
      </div>
    </>
  );
}
