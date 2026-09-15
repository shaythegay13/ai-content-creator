import { notFound } from 'next/navigation';
import { WorkspacePage } from '@/components/workspace-views';
import { getWorkspace } from '@/services/workspace';
import { Calendar } from '@/components/manage/calendar';
import { Ideas, Posts, Media, Intelligence } from '@/components/manage/library';
import { Review, Opportunities } from '@/components/manage/editorial';
import { Settings } from '@/components/manage/settings';
import { Assistant } from '@/components/manage/assistant';
import { Search } from '@/components/manage/search';
import { NewContent } from '@/components/manage/editor';
import { timezone } from '@/lib/config';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ q?: string; date?: string }>;
}) {
  const { section } = await params;
  const { q, date } = await searchParams;
  const data = await getWorkspace();
  const zone = timezone();
  switch (section) {
    case 'calendar':
      return <Calendar data={data} zone={zone} />;
    case 'ideas':
      return <Ideas data={data} />;
    case 'posts':
      return <Posts data={data} />;
    case 'media':
      return <Media data={data} />;
    case 'intelligence':
      return <Intelligence data={data} />;
    case 'morning-review':
      return <Review data={data} />;
    case 'trends':
      return <Opportunities data={data} />;
    case 'assistant':
      return (
        <Assistant
          data={data}
          provider={process.env.GROQ_API_KEY ? 'Groq' : 'Mock AI'}
        />
      );
    case 'settings':
      return (
        <Settings
          data={data}
          zone={zone}
          config={{
            ai: process.env.GROQ_API_KEY ? 'Groq configured' : 'Mock AI',
            notion: process.env.NOTION_API_KEY
              ? 'Notion configured'
              : 'Mock Notion',
            reviewTime: process.env.DAILY_INTELLIGENCE_REVIEW_TIME || '',
          }}
        />
      );
    case 'search':
      return <Search data={data} query={q || ''} />;
    case 'create':
      return <NewContent date={date} />;
    case 'analytics':
      return <WorkspacePage section={section} data={data} />;
    default:
      notFound();
  }
}
