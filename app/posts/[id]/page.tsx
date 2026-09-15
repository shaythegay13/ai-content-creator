import { notFound } from 'next/navigation';
import { Editor } from '@/components/manage/editor';
import { getWorkspace } from '@/services/workspace';
import { timezone } from '@/lib/config';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const { date } = await searchParams;
  const data = await getWorkspace();
  if (!data.posts.some((p) => p.id === id)) notFound();
  return <Editor data={data} id={id} zone={timezone()} date={date} />;
}
