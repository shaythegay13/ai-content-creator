import 'server-only';
import { isLocalMode } from '../lib/config';
import {
  MockAIProvider,
  MockTranscriptionProvider,
  MockMediaUnderstandingProvider,
  MockSocialPublisher,
  MockSocialAnalyticsProvider,
  MockTrendSource,
  MockIntelligenceSourceProvider,
  MockChatChannel,
} from './mocks';
import { LocalMediaStorageProvider } from './storage';
import { GroqAIProvider, GroqTranscriptionProvider } from './groq';
import { NotionIntelligenceProvider } from './notion';
export function providers() {
  if (!isLocalMode())
    throw new Error(
      'Production providers are not enabled in this local workspace.',
    );
  return {
    ai: process.env.GROQ_API_KEY ? new GroqAIProvider() : new MockAIProvider(),
    transcription:
      process.env.GROQ_API_KEY && process.env.AI_TRANSCRIPTION_MODEL
        ? new GroqTranscriptionProvider()
        : new MockTranscriptionProvider(),
    mediaUnderstanding: new MockMediaUnderstandingProvider(),
    publisher: new MockSocialPublisher(),
    analytics: new MockSocialAnalyticsProvider(),
    trends: new MockTrendSource(),
    intelligence: process.env.NOTION_API_KEY
      ? new NotionIntelligenceProvider({
          key: process.env.NOTION_API_KEY,
          databaseId: process.env.NOTION_DAILY_BRIEF_DATABASE_ID,
          pageId: process.env.NOTION_DAILY_BRIEF_PAGE_ID,
          mapping: JSON.parse(process.env.NOTION_PROPERTY_MAPPING_JSON || '{}'),
        })
      : new MockIntelligenceSourceProvider(),
    chat: new MockChatChannel(),
    storage: new LocalMediaStorageProvider(),
  };
}
