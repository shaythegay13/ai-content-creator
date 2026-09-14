import { Dashboard } from '@/components/workspace-views';
import { getWorkspace } from '@/services/workspace';
export const dynamic = 'force-dynamic';
export default async function Home() {
  return <Dashboard data={await getWorkspace()} />;
}
