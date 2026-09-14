'use client';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createContent, uploadMedia, saveProfile, chat } from '@/app/actions';
import { Button } from './ui/button';
const initial = { ok: false, message: '' };
function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : children}
    </Button>
  );
}
function Feedback({ state }: { state: typeof initial }) {
  return state.message ? (
    <p role="status" className={state.ok ? 'feedback success' : 'feedback'}>
      {state.message}
    </p>
  ) : null;
}
export function CreateForm({ kind = 'post' }: { kind?: 'post' | 'idea' }) {
  const [state, action] = useActionState(createContent, initial);
  return (
    <form action={action} className="form-stack">
      <label>
        Save as
        <select name="kind" defaultValue={kind}>
          <option value="post">Content post</option>
          <option value="idea">Idea</option>
        </select>
      </label>
      <label>
        Title
        <input
          name="title"
          placeholder="What is the core idea?"
          required
          minLength={3}
          maxLength={240}
        />
      </label>
      <label>
        Content / raw note
        <textarea
          name="body"
          placeholder="Start with a thought. Shape it into something worth sharing."
          rows={7}
          required
          maxLength={20000}
        />
      </label>
      <label>
        Platform variants
        <select name="platform">
          <option value="both">X + LinkedIn</option>
          <option value="x">X</option>
          <option value="linkedin">LinkedIn</option>
        </select>
      </label>
      <p className="muted text-xs">
        Platform variants stay linked to one content concept. New posts are
        saved as drafts.
      </p>
      <Submit>Save to workspace</Submit>
      <Feedback state={state} />
    </form>
  );
}
export function UploadForm() {
  const [state, action] = useActionState(uploadMedia, initial);
  return (
    <form action={action} className="form-stack">
      <label>
        Choose media
        <input
          type="file"
          name="file"
          required
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/mpeg,audio/mp4,audio/wav,audio/webm,audio/ogg"
        />
      </label>
      <label>
        Description
        <input
          name="description"
          placeholder="What could this help you tell?"
          maxLength={2000}
        />
      </label>
      <p className="muted text-xs">
        Images, video and audio · up to 20 MB · stored on this computer
      </p>
      <Submit>Upload media</Submit>
      <Feedback state={state} />
    </form>
  );
}
export function ProfileForm({
  tone,
  instructions,
}: {
  tone: string;
  instructions: string;
}) {
  const [state, action] = useActionState(saveProfile, initial);
  return (
    <form action={action} className="form-stack">
      <label>
        Tone
        <input name="tone" defaultValue={tone} required maxLength={500} />
      </label>
      <label>
        Personal writing instructions
        <textarea
          name="instructions"
          rows={5}
          defaultValue={instructions}
          maxLength={5000}
        />
      </label>
      <Submit>Save preferences</Submit>
      <Feedback state={state} />
    </form>
  );
}
export function ChatForm() {
  const [state, action] = useActionState(chat, initial);
  return (
    <form action={action} className="form-stack">
      <label className="sr-only" htmlFor="prompt">
        Message
      </label>
      <textarea
        id="prompt"
        name="prompt"
        placeholder="What are you thinking about writing?"
        rows={3}
        required
        maxLength={8000}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="muted text-xs">
          Mock assistant · no external API calls
        </span>
        <Submit>Send message</Submit>
      </div>
      <Feedback state={state} />
    </form>
  );
}
