import { eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import * as s from '../db/schema';
export function dayKey(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
export async function createMockReview(
  db: Database,
  timezone: string,
  now = new Date(),
) {
  const reviewDate = dayKey(now, timezone);
  return db.transaction(async (tx) => {
    const [review] = await tx
      .insert(s.dailyEditorialReviews)
      .values({
        reviewDate,
        timezone,
        status: 'awaiting_decisions',
        mock: true,
        context: { notice: 'Deterministic sample workflow, not AI analysis.' },
      })
      .onConflictDoNothing()
      .returning();
    if (!review) return;
    const scheduled = await tx
      .select({
        variant: s.contentPostVariants,
        calendar: s.contentCalendarEntries,
      })
      .from(s.contentCalendarEntries)
      .innerJoin(
        s.contentPostVariants,
        eq(s.contentPostVariants.id, s.contentCalendarEntries.variantId),
      );
    const evidence = await tx.select().from(s.intelligenceItems);
    for (const { variant } of scheduled.filter(
      (row) =>
        row.variant.status === 'scheduled' &&
        dayKey(row.calendar.scheduledAt, timezone) === reviewDate,
    )) {
      const [item] = await tx
        .insert(s.dailyEditorialPostReviews)
        .values({
          reviewId: review.id,
          variantId: variant.id,
          recommendation: 'KEEP',
          reasons: [
            'Sample review: retain the scheduled draft until you evaluate the supporting brief. No AI analysis has run.',
          ],
          originalText: variant.body,
          suggestedRevision: null,
          evidenceSnapshot: evidence.map((i) => ({
            id: i.id,
            title: i.title,
            summary: i.summary,
          })),
        })
        .returning();
      if (evidence[0])
        await tx.insert(s.editorialSupportingIntelligence).values({
          postReviewId: item.id,
          intelligenceItemId: evidence[0].id,
        });
    }
  });
}
