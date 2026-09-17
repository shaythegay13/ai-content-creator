import { randomUUID } from 'node:crypto';
import type {
  AIProvider,
  TranscriptionProvider,
  MediaUnderstandingProvider,
  SocialPublisher,
  SocialAnalyticsProvider,
  TrendSource,
  IntelligenceSourceProvider,
  ChatChannel,
  AuthenticationProvider,
  AIRequest,
} from './contracts';
import {
  withoutHashtags,
  validatePlatform,
  composePost,
} from '../lib/platform-validation';
export const DEV_USER_ID = '00000000-0000-4000-8000-000000000001';
export class MockAuthenticationProvider implements AuthenticationProvider {
  async currentUser() {
    return { id: DEV_USER_ID, name: 'Shay', email: 'owner@localhost.test' };
  }
}
export class MockAIProvider implements AIProvider {
  readonly name = 'mock';
  async complete(request: AIRequest) {
    const last = request.messages.at(-1)?.content || '';
    let task;
    try {
      task = JSON.parse(last);
    } catch {}
    if (task?.task !== 'platform-draft')
      return this.generate(request.messages.map((m) => m.content).join('\n'));
    const source = withoutHashtags(String(task.source));
    const choices: [RegExp, string[]][] = [
      [
        /prediction|retention|market/i,
        [
          'PredictionMarkets',
          'ProductStrategy',
          'CustomerRetention',
          'Startups',
          'ProductManagement',
        ],
      ],
      [
        /sports|betting/i,
        [
          'SportsBetting',
          'SportsTech',
          'ProductStrategy',
          'Innovation',
          'Technology',
        ],
      ],
      [
        /\bAI\b|artificial intelligence/i,
        ['AI', 'Technology', 'ProductDevelopment', 'Startups', 'Innovation'],
      ],
      [
        /founder|customer|interview|assumption|startup/i,
        [
          'Startups',
          'FounderLessons',
          'CustomerDiscovery',
          'ProductDevelopment',
          'Entrepreneurship',
        ],
      ],
    ];
    const pool = choices.find(([pattern]) => pattern.test(source))?.[1] || [
      'Writing',
      'ContentCreation',
      'Communication',
      'Storytelling',
      'Creativity',
    ];
    const prefs = task.hashtagPreferences;
    const hashtags = prefs.enabled
      ? pool.slice(
          0,
          Math.min(
            prefs.max,
            Math.max(prefs.min, task.platform === 'x' ? 2 : 3),
          ),
        )
      : [];
    const sentences = source.match(/[^.!?\n]+[.!?]?/g) || [];
    const first = sentences
      .find(
        (s: string) =>
          s.trim().length > 15 &&
          validatePlatform('x', composePost(s.trim(), hashtags)).count < 220,
      )
      ?.trim();
    let body =
      task.platform === 'x'
        ? first ||
          'What would change our mind? Test one assumption, listen carefully, and let the evidence shape the next decision.'
        : `${source}\n\nThe useful question is what this changes in practice. Start with one clear assumption, test it, and make the tradeoff explicit.\n\nWhat would you measure next?`;
    if (task.action === 'Improve Hook' && task.platform === 'x')
      body = 'The question I keep coming back to:\n\n' + body;
    if (
      task.platform === 'x' &&
      !validatePlatform('x', composePost(body, hashtags)).valid
    )
      body =
        'What would change our mind? Test one assumption, listen carefully, and let the evidence shape the next decision.';
    return {
      text: JSON.stringify({ platform: task.platform, body, hashtags }),
      model: 'mock-platform-v1',
      inputTokens: 0,
      outputTokens: 0,
    };
  }
  async generate(prompt: string) {
    return {
      text: `Mock brainstorming response — no AI API was called.\n\nFor “${prompt.slice(0, 180)}”, try these angles:\n\n1. Start with a specific moment from building your company. What changed your mind?\n2. Explain the tradeoff behind the decision, with a concrete example.\n3. Close with a question your audience can answer from experience.\n\nSave the strongest angle as an idea, then write an X and LinkedIn variant.`,
      model: 'mock-editor-v1',
      inputTokens: 0,
      outputTokens: 0,
    };
  }
}
export class MockTranscriptionProvider implements TranscriptionProvider {
  async transcribe() {
    return {
      text: '[Mock transcript] Founder voice note: share one lesson from the latest hackathon and explain what you would build differently.',
      mock: true,
    };
  }
}
export class MockMediaUnderstandingProvider implements MediaUnderstandingProvider {
  async analyze() {
    return {
      description:
        'Mock analysis placeholder. This file has not been visually analyzed.',
      topics: [],
      mock: true,
    };
  }
}
export class MockSocialPublisher implements SocialPublisher {
  async publish(input: { approved: boolean }) {
    if (!input.approved) throw new Error('Explicit approval is required.');
    return { externalId: `mock-${randomUUID()}`, simulated: true };
  }
}
export class MockSocialAnalyticsProvider implements SocialAnalyticsProvider {
  async metrics() {
    return { impressions: 8420, likes: 146, comments: 28 };
  }
}
export class MockTrendSource implements TrendSource {
  async fetch() {
    return [
      {
        externalId: 'retention',
        source: 'mock-social',
        title: 'Retention is the next prediction-market story',
        summary:
          'Sample opportunity: move the conversation from acquisition spikes to repeat participation.',
        score: 94,
      },
      {
        externalId: 'small-teams',
        source: 'mock-social',
        title: 'Small teams, unusually fast shipping',
        summary:
          'Sample opportunity: share the practical workflow behind your latest AI build.',
        score: 87,
      },
      {
        externalId: 'fundraising',
        source: 'mock-social',
        title: 'What founders learn between fundraising rounds',
        summary:
          'Sample opportunity: a candid lesson about choosing the right proof points.',
        score: 81,
      },
    ];
  }
}
export class MockIntelligenceSourceProvider implements IntelligenceSourceProvider {
  async fetch() {
    const publishedAt = new Date();
    return [
      {
        externalId: 'notion-retention',
        source: 'mock-notion',
        title: 'Prediction markets: the retention question',
        summary:
          'Sample daily brief: sustainable engagement may matter more than event-driven acquisition. Connect this to your planned founder perspective.',
        category: 'prediction_market_news',
        importance: 3,
        publishedAt,
      },
      {
        externalId: 'notion-sportsbook',
        source: 'mock-notion',
        title: 'Sportsbook product teams explore personalization',
        summary:
          'Sample research note: compare useful personalization with promotional volume. No real operator announcement is represented.',
        category: 'sportsbook_news',
        importance: 2,
        publishedAt,
      },
      {
        externalId: 'notion-ai',
        source: 'mock-notion',
        title: 'AI prototypes need a feedback loop',
        summary:
          'Sample technology brief: the gap between a working demo and a useful product is often a repeatable evaluation process.',
        category: 'technology',
        importance: 2,
        publishedAt,
      },
    ];
  }
}
export class MockChatChannel implements ChatChannel {
  async receive() {
    return [];
  }
  async send() {
    return { simulated: true };
  }
}
