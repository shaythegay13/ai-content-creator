import { notFound } from 'next/navigation';
import { WorkspacePage } from '@/components/workspace-views';
import { getWorkspace } from '@/services/workspace';
export const dynamic = 'force-dynamic';
const sections = [
  'morning-review',
  'calendar',
  'ideas',
  'posts',
  'media',
  'intelligence',
  'trends',
  'analytics',
  'assistant',
  'settings',
  'create',
  'search',
];
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  const { q } = await searchParams;
  return (
    <WorkspacePage
      section={section}
      data={await getWorkspace()}
      query={q || ''}
    />
  );
}
