import type { Workspace } from '@/services/workspace';
export function DraftExplanation({
  data,
  postId,
  platform,
}: {
  data: Workspace;
  postId: string;
  platform: string;
}) {
  const assessment = data.draftAssessments.find(
    (a) =>
      a.platform === platform &&
      data.contentBriefs.some((b) => b.id === a.briefId && b.postId === postId),
  );
  const row = data.contentBriefs.find((b) =>
    assessment ? b.id === assessment.briefId : b.postId === postId,
  );
  if (!row)
    return (
      <p className="muted">
        Generate a strategic draft to inspect its brief and context. Add
        profiles in Settings for stronger personalization.
      </p>
    );
  const b = row.brief;
  const execution = b.platformExecution as Record<string, string> | undefined;
  const records = (row.context.records || []) as {
    type: string;
    id: string;
    text: string;
    sourceUrl?: string;
    date?: string;
    status?: string;
  }[];
  return (
    <details className="panel form-stack">
      <summary>Why this draft?</summary>
      <p>
        Latest generated proposal or draft; manually edited text may differ.
      </p>
      <p>
        <strong>Angle:</strong> {String(b.strongestAngle || '')}
      </p>
      <p>
        <strong>Source insight:</strong> {String(b.sourceInsight || '')}
      </p>
      <p>
        <strong>Why:</strong> {String(b.whyItMatters || '')}
      </p>
      <p>
        <strong>Objective:</strong> {String(b.objective || '')}
      </p>
      <p>
        <strong>Platform decision:</strong> {execution?.[platform]}
      </p>
      <p>
        <strong>Critique:</strong>{' '}
        {String(assessment?.critique.summary || 'Not yet completed')}{' '}
        {assessment?.revised
          ? 'One revision was triggered.'
          : 'No material revision triggered.'}
      </p>
      <p>Quality scores are editorial aids, not predictions of engagement.</p>
      <details>
        <summary>View brief and quality assessment</summary>
        <p>
          Stored editorial summaries and scores; no private reasoning tokens.
        </p>
        <pre className="whitespace-pre-wrap break-words">
          {JSON.stringify(
            { brief: b, assessment: assessment?.critique },
            null,
            2,
          )}
        </pre>
      </details>
      {(row.context.missing as string[] | undefined)?.length ? (
        <p>
          Missing profiles: {(row.context.missing as string[]).join(', ')}. Add
          them in Settings.
        </p>
      ) : null}
      <details>
        <summary>View context used</summary>
        <p>
          Intended date: {String(row.context.intendedDate || '')}.{' '}
          {String(row.context.performanceNote || '')}
        </p>
        {records.map((r) => (
          <article key={r.type + r.id} className="panel">
            <strong>{r.type}</strong> <code>{r.id}</code>
            <p>{r.text}</p>
            {r.date && <p>{r.date}</p>}
            {r.status && <p>{r.status}</p>}
            {r.sourceUrl && /^https?:\/\//.test(r.sourceUrl) && (
              <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                Source
              </a>
            )}
          </article>
        ))}
      </details>
    </details>
  );
}
