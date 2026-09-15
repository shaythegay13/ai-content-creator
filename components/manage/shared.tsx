'use client';
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  useState,
  useSyncExternalStore,
} from 'react';
import { useRouter } from 'next/navigation';
import { manage, type ManageResult } from '@/app/manage-actions';
import { Button } from '@/components/ui/button';
export { Button };
export const split = (s: string) =>
  s
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
export function useManage() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const router = useRouter();
  async function run(
    action: string,
    input: Record<string, unknown>,
    success?: (data: unknown) => void,
  ): Promise<ManageResult> {
    setBusy(true);
    setNotice('');
    try {
      const result: ManageResult = await manage(action, input);
      setNotice(result.message);
      if (result.ok) {
        success?.(result.data);
        router.refresh();
      }
      return result;
    } catch {
      const result = { ok: false, message: 'Connection failed. Try again.' };
      setNotice(result.message);
      return result;
    } finally {
      setBusy(false);
    }
  }
  return { busy, notice, run };
}
export function Notice({ text }: { text: string }) {
  return text ? (
    <p role="status" className="action-notice">
      {text}
    </p>
  ) : null;
}
const subscribeReady = () => () => {};
export function Title({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  const ready = useSyncExternalStore(
    subscribeReady,
    () => true,
    () => false,
  );
  return (
    <div className="page-heading" data-ready={ready}>
      <div>
        <p className="eyebrow">YOUR CONTENT WORKSPACE</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {children}
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const fieldId = useId();
  const controls = Children.toArray(children);
  const first = controls[0];
  const controlId = isValidElement<{ id?: string }>(first)
    ? first.props.id || fieldId
    : fieldId;
  return (
    <div className="field-label">
      <label htmlFor={controlId}>{label}</label>
      {controls.map((child, index) =>
        index === 0 && isValidElement<{ id?: string }>(child)
          ? cloneElement(child, { id: controlId })
          : child,
      )}
    </div>
  );
}
export function safeLink(url: string | null | undefined) {
  return url && /^https?:\/\//i.test(url) ? url : undefined;
}
