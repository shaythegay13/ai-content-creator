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
export function providers() {
  if (!isLocalMode())
    throw new Error(
      'Production providers are not enabled in the foundation stage.',
    );
  return {
    ai: new MockAIProvider(),
    transcription: new MockTranscriptionProvider(),
    mediaUnderstanding: new MockMediaUnderstandingProvider(),
    publisher: new MockSocialPublisher(),
    analytics: new MockSocialAnalyticsProvider(),
    trends: new MockTrendSource(),
    intelligence: new MockIntelligenceSourceProvider(),
    chat: new MockChatChannel(),
    storage: new LocalMediaStorageProvider(),
  };
}
