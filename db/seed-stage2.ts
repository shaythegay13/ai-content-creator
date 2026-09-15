import { eq } from 'drizzle-orm';
import type { Database } from './client';
import * as s from './schema';
import { localDateTime, zonedInput } from '../lib/time';
export async function seedStage2(db: Database) {
  if (
    (
      await db
        .select()
        .from(s.appSettings)
        .where(eq(s.appSettings.key, 'stage2-seed'))
    ).length
  )
    return;
  await db.transaction(async (tx) => {
    for (const name of [
      'PlayMind Labs',
      'AI',
      'Startups',
      'Fundraising',
      'Prediction Markets',
      'Sports Betting',
      'Founder Lessons',
      'Hackathons',
      'Building in Public',
    ])
      await tx.insert(s.contentTopics).values({ name }).onConflictDoNothing();
    await tx
      .insert(s.intelligenceItems)
      .values({
        source: 'mock-notion',
        externalId: 'sample-policy',
        title: 'Sample policy brief: prediction-market rules under review',
        summary:
          'Fictional fixture: a proposed policy change could alter the assumptions in a prediction-market draft. Verify the actual rule before making a public claim.',
        category: 'legislation',
        importance: 3,
        publishedAt: new Date(),
        entities: ['Example regulator'],
        topics: ['Prediction Markets'],
        relevance: 85,
        relevanceReasons: [
          'Policy significance',
          'Prediction-market topic match',
        ],
        metadata: {
          fictional: true,
          jurisdiction: 'Sample jurisdiction',
          status: 'Fictional proposal',
        },
      })
      .onConflictDoNothing();
    const [sportsPost] = await tx
      .select()
      .from(s.contentPosts)
      .where(
        eq(
          s.contentPosts.title,
          'Sportsbook personalization should reduce friction',
        ),
      );
    if (sportsPost) {
      const variants = await tx
        .select()
        .from(s.contentPostVariants)
        .where(eq(s.contentPostVariants.postId, sportsPost.id));
      const variant = variants.find((v) => v.platform === 'linkedin');
      if (variant) {
        const zone = process.env.APP_TIMEZONE || 'America/New_York';
        const at = localDateTime(
          `${zonedInput(new Date(), zone).slice(0, 10)}T16:00`,
          zone,
        );
        await tx
          .insert(s.contentCalendarEntries)
          .values({ variantId: variant.id, scheduledAt: at, timezone: zone })
          .onConflictDoNothing();
        await tx
          .update(s.contentPostVariants)
          .set({ status: 'scheduled' })
          .where(eq(s.contentPostVariants.id, variant.id));
        await tx
          .update(s.contentPosts)
          .set({ status: 'scheduled' })
          .where(eq(s.contentPosts.id, sportsPost.id));
      }
    }
    await tx.insert(s.appSettings).values({ key: 'stage2-seed', value: true });
  });
}
