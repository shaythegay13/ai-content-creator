'use client';
import type { Workspace } from '@/services/workspace';
import { Title, Field, Button, Notice, useManage, split } from './shared';
export function Settings({
  data,
  zone,
  config,
}: {
  data: Workspace;
  zone: string;
  config: { ai: string; notion: string; reviewTime: string };
}) {
  const { run, busy, notice } = useManage();
  const p = data.profile;
  return (
    <>
      <Title
        title="Settings"
        description="Your voice, your topics, and a clear view of AI usage."
      />
      <div className="split-layout">
        <form
          className="panel form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run('saveProfile', {
              tone: f.get('tone'),
              sentenceStyle: f.get('sentenceStyle'),
              hookStyle: f.get('hookStyle'),
              formattingPreferences: f.get('formattingPreferences'),
              phrasesToAvoid: split(String(f.get('phrasesToAvoid'))),
              preferredPhrases: split(String(f.get('preferredPhrases'))),
              ctaStyle: f.get('ctaStyle'),
              platformPreferences: {
                x: String(f.get('x')),
                linkedin: String(f.get('linkedin')),
              },
              topics: split(String(f.get('topics'))),
              personalInstructions: f.get('personalInstructions'),
            });
          }}
        >
          <h2>Writing profile</h2>
          {[
            ['tone', 'Tone', p?.tone],
            ['sentenceStyle', 'Sentence style', p?.sentenceStyle],
            ['hookStyle', 'Preferred hook style', p?.hookStyle],
            ['formattingPreferences', 'Formatting', p?.formattingPreferences],
            [
              'phrasesToAvoid',
              'Phrases to avoid (comma separated)',
              p?.phrasesToAvoid?.join(', '),
            ],
            [
              'preferredPhrases',
              'Preferred phrases',
              p?.preferredPhrases?.join(', '),
            ],
            ['ctaStyle', 'CTA preferences', p?.ctaStyle],
            ['x', 'X style', p?.platformPreferences?.x],
            ['linkedin', 'LinkedIn style', p?.platformPreferences?.linkedin],
            ['topics', 'Writing topics', p?.topics?.join(', ')],
          ].map(([name, label, value]) => (
            <Field key={name} label={label!}>
              <input
                name={name!}
                defaultValue={value || ''}
                required={name === 'tone'}
              />
            </Field>
          ))}
          <Field label="Other instructions">
            <textarea
              name="personalInstructions"
              rows={5}
              defaultValue={p?.personalInstructions || ''}
            />
          </Field>
          <Button disabled={busy}>Save writing profile</Button>
          <Notice text={notice} />
        </form>
        <div className="column-stack">
          <section className="panel">
            <h2>Content topics</h2>
            {data.topics.map((t) => (
              <form
                className="topic-row"
                key={t.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  run('saveTopic', {
                    id: t.id,
                    name: new FormData(e.currentTarget).get('name'),
                  });
                }}
              >
                <input
                  aria-label={`Topic ${t.name}`}
                  name="name"
                  defaultValue={t.name}
                />
                <Button size="sm" variant="outline">
                  Save
                </Button>
                <button
                  type="button"
                  aria-label={`Remove ${t.name}`}
                  onClick={() => {
                    if (
                      confirm(
                        `Remove topic “${t.name}”? Linked content will be retained.`,
                      )
                    )
                      run('deleteTopic', { id: t.id, confirmed: true });
                  }}
                >
                  ×
                </button>
              </form>
            ))}
            <form
              className="topic-row"
              onSubmit={(e) => {
                e.preventDefault();
                run('saveTopic', {
                  name: new FormData(e.currentTarget).get('name'),
                });
                e.currentTarget.reset();
              }}
            >
              <input
                name="name"
                aria-label="New topic"
                placeholder="New topic"
                required
              />
              <Button size="sm">Add</Button>
            </form>
          </section>
          <section className="panel">
            <h2>Connections</h2>
            <div className="settings-details">
              <p>
                <strong>AI</strong>
                {config.ai}
              </p>
              <p>
                <strong>Notion (read only)</strong>
                {config.notion}
              </p>
              <p>
                <strong>Timezone</strong>
                {zone}
              </p>
              <p>
                <strong>Daily review time</strong>
                {config.reviewTime || 'Not configured'} · manual trigger active
              </p>
              <p>
                <strong>Publishing</strong>Disabled
              </p>
            </div>
            <p className="muted text-xs mt-4">
              Configure keys and model names in .env.local, then restart the
              server. Secrets are never displayed here.
            </p>
          </section>
        </div>
      </div>
      <section className="panel mt-6">
        <h2>AI usage</h2>
        <p className="muted my-3">
          Estimated cost is shown only when per-million-token rates are
          configured. Audio duration pricing is not estimated.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Provider / model</th>
                <th>Request</th>
                <th>Input</th>
                <th>Output</th>
                <th>Estimated USD</th>
              </tr>
            </thead>
            <tbody>
              {data.usage.map((u) => (
                <tr key={u.id}>
                  <td>{new Date(u.createdAt).toLocaleString()}</td>
                  <td>
                    {u.provider} / {u.model}
                  </td>
                  <td>{u.requestType}</td>
                  <td>{u.inputTokens}</td>
                  <td>{u.outputTokens}</td>
                  <td>{u.estimatedCost ?? 'Not calculated'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
