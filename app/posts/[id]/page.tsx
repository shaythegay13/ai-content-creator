import { notFound } from 'next/navigation';
import { PostDetail } from '@/components/workspace-views';
import { getWorkspace } from '@/services/workspace';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getWorkspace();
  if (!data.posts.some((p) => p.id === id)) notFound();
  return <PostDetail data={data} id={id} />;
}
