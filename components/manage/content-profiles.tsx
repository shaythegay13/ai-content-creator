'use client';
import type { Workspace } from '@/services/workspace';
import {
  profileFields,
  profileTitles,
  fieldLabel,
  type ProfileKind,
} from '@/lib/content-profiles';
import { Field, Button, Notice, useManage } from './shared';
export function ContentProfiles({ data }: { data: Workspace }) {
  const { run, busy, notice } = useManage();
  return (
    <section className="panel form-stack mb-6">
      <h2>Your content brain</h2>
      <p>
        Describe who you are, what your company does, and what social media
        should do for you. These fields feed brief creation and draft review.
        Enter only personal context you want used publicly.
      </p>
      {(['user', 'company', 'strategy'] as const).some(
        (kind) =>
          !data.contentProfiles.some(
            (p) => p.kind === kind && Object.values(p.fields).some(Boolean),
          ),
      ) && (
        <p className="notice">
          Personalization is incomplete. Fill in About me, About my company and
          Social strategy for stronger context. Generation still works with your
          notes.
        </p>
      )}
      {(Object.keys(profileFields) as ProfileKind[]).map((kind) => (
        <details key={kind}>
          <summary>{profileTitles[kind]}</summary>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              run('saveContentProfile', {
                kind,
                fields: Object.fromEntries(new FormData(e.currentTarget)),
              });
            }}
          >
            {profileFields[kind].map((key) => (
              <Field key={key} label={fieldLabel(key)}>
                <textarea
                  name={key}
                  maxLength={2000}
                  rows={2}
                  defaultValue={
                    data.contentProfiles.find((p) => p.kind === kind)?.fields[
                      key
                    ] || ''
                  }
                />
              </Field>
            ))}
            <Button disabled={busy}>
              Save {profileTitles[kind].toLowerCase()}
            </Button>
          </form>
        </details>
      ))}
      <p>
        Writing style is configured separately below. Approved claims are
        user-provided, not independently verified.
      </p>
      <Notice text={notice} />
    </section>
  );
}
