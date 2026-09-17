'use client';
import { useState } from 'react';
import type { Workspace } from '@/services/workspace';
import { processVoice } from '@/app/manage-actions';
import { Title, Field, Button, Notice, useManage } from './shared';
type Idea = { title: string; note: string };
export function Assistant({
  data,
  provider,
}: {
  data: Workspace;
  provider: string;
}) {
  const [conversationId, setConversationId] = useState('');
  const [prompt, setPrompt] = useState('');
  const { run, busy, notice } = useManage();
  const messages = data.messages.filter(
    (m) => m.conversationId === conversationId,
  );
  const calls = data.toolCalls.filter(
    (c) => c.conversationId === conversationId,
  );
  return (
    <>
      <Title
        title="AI Assistant"
        description={`Your private Head of Content · ${provider}`}
      >
        <Button variant="outline" onClick={() => setConversationId('')}>
          New conversation
        </Button>
      </Title>
      <div className="assistant-layout">
        <section className="panel column-stack">
          <Field label="Conversations">
            <select
              value={conversationId}
              onChange={(e) => setConversationId(e.target.value)}
            >
              <option value="">New conversation</option>
              {data.conversations.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="conversation">
            {messages.length ? (
              messages.map((m) => (
                <article key={m.id} className={`message message-${m.role}`}>
                  <span className="tiny-label">
                    {m.role === 'user' ? 'You' : provider}
                  </span>
                  <p>{m.content}</p>
                </article>
              ))
            ) : (
              <p className="muted">
                Bring a rough thought. Try “I realized prediction markets have a
                retention problem.” Then refine the angle together.
              </p>
            )}
          </div>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              await run(
                'chat',
                { prompt, conversationId: conversationId || undefined },
                (d) => {
                  setConversationId(
                    (d as { conversationId: string }).conversationId,
                  );
                  setPrompt('');
                },
              );
            }}
          >
            <Field label="Message">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                required
                maxLength={8000}
              />
            </Field>
            <Button disabled={busy}>
              {busy ? 'Working…' : 'Send message'}
            </Button>
            <Notice text={notice} />
          </form>
          {calls.map((call) => (
            <div className="tool-card" key={call.id}>
              <h3>
                {call.name.replace(/([A-Z])/g, ' $1')}{' '}
                <span className="badge">{call.status}</span>
              </h3>
              <dl className="metadata-list">
                {Object.entries(call.arguments).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{Array.isArray(v) ? v.join(', ') : String(v)}</dd>
                  </div>
                ))}
              </dl>
              {call.status === 'pending' ? (
                <div className="button-row">
                  <Button
                    disabled={busy}
                    size="sm"
                    onClick={() =>
                      run('approveTool', { id: call.id, approved: true })
                    }
                  >
                    Approve action
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    size="sm"
                    onClick={() =>
                      run('approveTool', { id: call.id, approved: false })
                    }
                  >
                    Reject
                  </Button>
                </div>
              ) : call.result ? (
                <details>
                  <summary>Actual application result</summary>
                  <pre>{JSON.stringify(call.result, null, 2)}</pre>
                </details>
              ) : null}
            </div>
          ))}
        </section>
        <div className="column-stack">
          <ToolComposer
            data={data}
            conversationId={conversationId}
            onConversation={setConversationId}
          />
          <Voice data={data} />
        </div>
      </div>
      <div className="mt-6">
        <Ideation data={data} />
      </div>
    </>
  );
}
const tools: Record<string, string[]> = {
  createIdea: ['title', 'rawNote'],
  updateIdea: ['id', 'title', 'rawNote'],
  createPost: ['title', 'coreIdea'],
  updatePost: ['id', 'title', 'coreIdea'],
  createPlatformVariant: ['postId', 'platform', 'body'],
  schedulePost: ['variantId', 'localTime', 'timezone'],
  attachMedia: ['postId', 'mediaIds'],
  searchPosts: ['query'],
  searchIdeas: ['query'],
  searchMedia: ['query'],
  searchIntelligence: ['query'],
  getTodaysIntelligence: [],
  searchTrends: ['query'],
  inspectPostPerformance: [],
  getDailyEditorialReview: [],
  reviewPostAgainstIntelligence: ['variantId'],
  createIdeaFromIntelligence: ['intelligenceId'],
};
function ToolComposer({
  data,
  conversationId,
  onConversation,
}: {
  data: Workspace;
  conversationId: string;
  onConversation: (s: string) => void;
}) {
  const [name, setName] = useState('createIdea');
  const { run, busy, notice } = useManage();
  return (
    <form
      className="panel form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const args: Record<string, unknown> = {};
        for (const field of tools[name])
          args[field] = field === 'mediaIds' ? f.getAll(field) : f.get(field);
        run(
          'tool',
          {
            name,
            arguments: args,
            conversationId: conversationId || undefined,
          },
          (d) =>
            onConversation((d as { conversationId: string }).conversationId),
        );
      }}
    >
      <h2>Application actions</h2>
      <p className="muted text-xs">
        Actions use real application services. Write operations are queued for
        your approval.
      </p>
      <Field label="Action">
        <select value={name} onChange={(e) => setName(e.target.value)}>
          {Object.keys(tools).map((n) => (
            <option key={n} value={n}>
              {n.replace(/([A-Z])/g, ' $1')}
            </option>
          ))}
        </select>
      </Field>
      <div className="form-stack" key={name}>
        {tools[name].map((field) => {
          let options: { id: string; label: string }[] = [];
          if (field === 'postId' || (field === 'id' && name === 'updatePost'))
            options = data.posts.map((p) => ({ id: p.id, label: p.title }));
          if (field === 'id' && name === 'updateIdea')
            options = data.ideas.map((i) => ({ id: i.id, label: i.title }));
          if (field === 'variantId')
            options = data.variants.map((v) => ({
              id: v.id,
              label: `${v.platform}: ${data.posts.find((p) => p.id === v.postId)?.title}`,
            }));
          if (field === 'intelligenceId')
            options = data.intelligence.map((i) => ({
              id: i.id,
              label: i.title,
            }));
          return (
            <Field key={field} label={field.replace(/([A-Z])/g, ' $1')}>
              {field === 'mediaIds' ? (
                <select name={field} multiple>
                  {data.media.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.filename}
                    </option>
                  ))}
                </select>
              ) : options.length ? (
                <select name={field}>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : field === 'platform' ? (
                <select name={field}>
                  <option>x</option>
                  <option>linkedin</option>
                </select>
              ) : (
                <input
                  name={field}
                  required
                  type={field === 'localTime' ? 'datetime-local' : 'text'}
                  defaultValue={field === 'timezone' ? 'America/New_York' : ''}
                />
              )}
            </Field>
          );
        })}
      </div>
      <Button disabled={busy}>Prepare action</Button>
      <Notice text={notice} />
    </form>
  );
}
function Voice({ data }: { data: Workspace }) {
  const { run, busy, notice } = useManage();
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [transcriptId, setTranscriptId] = useState('');
  const [text, setText] = useState('');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  return (
    <section className="panel form-stack">
      <h2>Voice notes</h2>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setUploading(true);
          try {
            const result = await processVoice(new FormData(e.currentTarget));
            setFeedback(result.message);
            if (result.ok) {
              const t = result.data as { id: string; text: string };
              setTranscriptId(t.id);
              setText(t.text);
            }
          } finally {
            setUploading(false);
          }
        }}
      >
        <Field label="Upload voice note">
          <input type="file" name="file" accept="audio/*" required />
        </Field>
        <Button disabled={uploading}>
          {uploading ? 'Transcribing…' : 'Transcribe audio'}
        </Button>
      </form>
      <Notice text={feedback} />
      <Field label="Saved transcripts">
        <select
          value={transcriptId}
          onChange={(e) => {
            const t = data.transcripts.find((t) => t.id === e.target.value);
            setTranscriptId(t?.id || '');
            setText(t?.text || '');
          }}
        >
          <option value="">Select transcript</option>
          {data.transcripts.map((t) => (
            <option key={t.id} value={t.id}>
              {data.media.find((m) => m.id === t.mediaId)?.filename}{' '}
              {t.mock ? '(mock)' : ''}
            </option>
          ))}
        </select>
      </Field>
      {transcriptId && (
        <>
          <Field label="Editable transcript">
            <textarea
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
          <div className="button-row">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => run('saveTranscript', { id: transcriptId, text })}
            >
              Save transcript
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                await run('saveTranscript', { id: transcriptId, text });
                run('ideate', { prompt: text }, (d) => setIdeas(d as Idea[]));
              }}
            >
              Find content ideas
            </Button>
          </div>
          <IdeaChoices ideas={ideas} source="voice" />
        </>
      )}
      <Notice text={notice} />
    </section>
  );
}
function IdeaChoices({
  ideas,
  source = 'ai',
}: {
  ideas: Idea[];
  source?: string;
}) {
  const { run, busy, notice } = useManage();
  const [selected, setSelected] = useState<number[]>([]);
  return ideas.length ? (
    <div className="form-stack">
      {ideas.map((idea, i) => (
        <label className="idea-choice" key={`${i}-${idea.title}`}>
          <input
            type="checkbox"
            checked={selected.includes(i)}
            onChange={(e) =>
              setSelected(
                e.target.checked
                  ? [...selected, i]
                  : selected.filter((n) => n !== i),
              )
            }
          />
          <span>
            <strong>{idea.title}</strong>
            <p>{idea.note}</p>
          </span>
        </label>
      ))}
      <div className="button-row">
        <Button
          disabled={busy || !selected.length}
          onClick={async () => {
            for (const i of selected)
              await run('saveIdea', {
                title: ideas[i].title,
                rawNote: ideas[i].note,
                source,
              });
            setSelected([]);
          }}
        >
          Save selected ideas
        </Button>
        <Button
          variant="outline"
          disabled={busy || !selected.length}
          onClick={async () => {
            for (const i of selected) {
              await run('createContent', {
                title: ideas[i].title,
                coreIdea: ideas[i].note,
              });
            }
            setSelected([]);
          }}
        >
          Generate draft posts
        </Button>
      </div>
      <Notice text={notice} />
    </div>
  ) : null;
}
export function Ideation({ data }: { data: Workspace }) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const { run, busy, notice } = useManage();
  return (
    <section className="panel form-stack">
      <h2>Find your next angle</h2>
      <p className="muted text-xs">
        Uses your writing profile and relevant posts, performance, intelligence
        and trends.
      </p>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(
            'ideate',
            {
              prompt: `Topic: ${f.get('topic')}. Pillar: ${f.get('pillar')}. Notes: ${f.get('notes')}`,
            },
            (d) => setIdeas(d as Idea[]),
          );
        }}
      >
        <div className="two-column">
          <Field label="Ideation topic">
            <select name="topic">
              {data.topics.map((t) => (
                <option key={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Content pillar">
            <input name="pillar" placeholder="e.g. Founder lessons" />
          </Field>
        </div>
        <Field label="Your notes">
          <textarea name="notes" rows={3} />
        </Field>
        <Button disabled={busy}>Generate content angles</Button>
      </form>
      <IdeaChoices ideas={ideas} />
      <Notice text={notice} />
    </section>
  );
}
