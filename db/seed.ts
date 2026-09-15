import { eq } from 'drizzle-orm';
import type { Database } from './client';
import * as s from './schema';
import { localDateTime, zonedInput } from '../lib/time';
import {
  DEV_USER_ID,
  MockIntelligenceSourceProvider,
  MockTrendSource,
} from '../providers/mocks';
export async function seed(db: Database) {
  if (
    (
      await db
        .select()
        .from(s.appSettings)
        .where(eq(s.appSettings.key, 'seed-version'))
    ).length
  )
    return;
  await db.transaction(async (tx) => {
    await tx
      .insert(s.users)
      .values({ id: DEV_USER_ID, name: 'Shay', email: 'owner@localhost.test' })
      .onConflictDoNothing();
    const topics = await tx
      .insert(s.contentTopics)
      .values(
        [
          'AI',
          'Startups',
          'Fundraising',
          'Prediction markets',
          'Sportsbooks',
          'Founder lessons',
          'Hackathons',
          'Building in public',
        ].map((name) => ({ name })),
      )
      .returning();
    await tx.insert(s.contentIdeas).values(
      [
        {
          title: 'What a 48-hour hackathon taught me about scope',
          rawNote:
            'The best thing we shipped was the feature we almost cut. Write about choosing the smallest complete user journey.',
          tags: ['hackathons', 'founder lessons'],
          topicId: topics[6].id,
          priority: 3,
          source: 'voice',
        },
        {
          title: 'Fundraising: show the learning velocity',
          rawNote:
            'A useful investor update connects experiments, evidence, and the next decision. Share a simple framework.',
          tags: ['fundraising', 'startups'],
          topicId: topics[2].id,
          priority: 2,
          source: 'manual',
        },
        {
          title: 'Build in public without turning everything into a launch',
          rawNote:
            'Small progress notes can be more useful than polished announcements. Share something that did not work.',
          tags: ['building in public'],
          topicId: topics[7].id,
          priority: 2,
          source: 'conversation',
        },
        {
          title: 'Where AI actually saves a founder time',
          rawNote:
            'Compare the tasks that got faster with those that still need human judgment.',
          tags: ['AI'],
          topicId: topics[0].id,
          priority: 3,
          source: 'ai',
        },
      ].map((idea) => ({ ...idea, userId: DEV_USER_ID })),
    );
    const concepts = [
      [
        'Why prediction-market retention matters',
        'scheduled',
        'The next prediction-market story is not just who signs up. It is who comes back. Acquisition gets attention. Repeat participation builds a product.',
      ],
      [
        'A small team is a product advantage',
        'scheduled',
        'Small teams cannot win by doing everything. We win by shortening the distance between a customer conversation and a product decision.',
      ],
      [
        'The hardest part of an AI demo starts after the demo',
        'draft',
        'A working demo proves possibility. A feedback loop proves usefulness. Here is what we are measuring next.',
      ],
      [
        'Sportsbook personalization should reduce friction',
        'ready',
        'Personalization is useful when it helps someone make a decision. More notifications are not the same as a better experience.',
      ],
      [
        'What we learned shipping our first prototype',
        'published',
        'We cut the roadmap in half and doubled the number of real conversations. The prototype finally started answering useful questions.',
      ],
      [
        'The founder lesson I keep relearning',
        'published',
        'Write down the assumption before you run the experiment. Otherwise it is too easy to call any result a success.',
      ],
    ] as const;
    for (let i = 0; i < concepts.length; i++) {
      const [title, status, body] = concepts[i];
      const [post] = await tx
        .insert(s.contentPosts)
        .values({ userId: DEV_USER_ID, title, status })
        .returning();
      const variants = await tx
        .insert(s.contentPostVariants)
        .values(
          ['x', 'linkedin'].map((platform) => ({
            postId: post.id,
            platform,
            body:
              platform === 'linkedin'
                ? `${body}\n\nThe question I keep coming back to: what would make this useful enough to become a habit?\n\nI am sharing the process as we build.`
                : body,
            status,
          })),
        )
        .returning();
      await tx.insert(s.postTopics).values({
        postId: post.id,
        topicId: topics[i === 0 ? 3 : i === 3 ? 4 : 5].id,
      });
      if (status === 'scheduled') {
        const zone = process.env.APP_TIMEZONE || 'America/New_York';
        const scheduledAt = localDateTime(
          `${zonedInput(new Date(), zone).slice(0, 10)}T${10 + i * 3}:30`,
          zone,
        );
        await tx.insert(s.contentCalendarEntries).values({
          variantId: variants[i % 2].id,
          scheduledAt,
          timezone: 'America/New_York',
        });
      }
      if (status === 'published') {
        const [pub] = await tx
          .insert(s.publishedPosts)
          .values({
            variantId: variants[0].id,
            externalId: `seed-${i}`,
            platform: 'x',
            simulated: true,
            publishedAt: new Date(Date.now() - (7 - i) * 86400000),
          })
          .returning();
        await tx.insert(s.postMetricSnapshots).values({
          publishedPostId: pub.id,
          impressions: i === 4 ? 8420 : 5260,
          likes: i === 4 ? 146 : 92,
          comments: i === 4 ? 28 : 17,
          shares: 19,
          clicks: 42,
        });
      }
    }
    await tx
      .insert(s.intelligenceItems)
      .values(await new MockIntelligenceSourceProvider().fetch());
    await tx.insert(s.trendItems).values(await new MockTrendSource().fetch());
    await tx.insert(s.mediaAssets).values(
      [
        {
          kind: 'image',
          filename: 'hackathon-whiteboard.jpg',
          storageKey: 'seed-whiteboard',
          mimeType: 'image/jpeg',
          size: 2450000,
          description:
            'Hackathon planning wall — a visual for the story about reducing scope.',
          tags: ['hackathon', 'behind the scenes'],
        },
        {
          kind: 'video',
          filename: 'prototype-walkthrough.mp4',
          storageKey: 'seed-prototype',
          mimeType: 'video/mp4',
          size: 18400000,
          description: 'A quick walkthrough of the first usable prototype.',
          tags: ['demo', 'building in public'],
        },
        {
          kind: 'audio',
          filename: 'founder-reflection.m4a',
          storageKey: 'seed-reflection',
          mimeType: 'audio/mp4',
          size: 1240000,
          description:
            'Voice note about the difference between shipping and learning.',
          tags: ['founder lessons'],
        },
      ].map((asset) => ({
        ...asset,
        userId: DEV_USER_ID,
        storageProvider: 'mock',
        metadata: {
          fixture: true,
          note: 'Metadata example only; upload a file to preview real media.',
        },
      })),
    );
    await tx.insert(s.aiRecommendations).values([
      {
        title: 'Turn a founder lesson into two platform variants',
        reason:
          'Sample recommendation: the same core idea can support a concise X post and a reflective LinkedIn post.',
      },
      {
        title: 'Use your hackathon media',
        reason:
          'Sample recommendation: a behind-the-scenes image can add context to your next building-in-public post.',
      },
    ]);
    await tx.insert(s.writingProfiles).values({
      userId: DEV_USER_ID,
      tone: 'Direct, thoughtful, practical',
      sentenceStyle: 'Short sentences with specific examples',
      formattingPreferences: 'Short paragraphs. No excessive emojis.',
      phrasesToAvoid: ['game-changing', 'delve', 'leverage'],
      preferredPhrases: ['Here is what we learned'],
      ctaStyle: 'Ask one useful question',
      platformPreferences: {
        x: 'One clear point. Keep it concise.',
        linkedin: 'A concrete story, then the lesson.',
      },
      topics: ['AI', 'startups', 'prediction markets'],
      personalInstructions:
        'Write like a founder sharing what they are learning. Avoid claims without evidence.',
    });
    await tx.insert(s.appSettings).values({ key: 'seed-version', value: 1 });
  });
}
