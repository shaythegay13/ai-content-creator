import type { Database } from '../db/client';
import type {
  AIProvider,
  IntelligenceSourceProvider,
} from '../providers/contracts';
import { syncIntelligenceItems, runEditorialReview } from './intelligence';
import { zonedInput } from '../lib/time';
// Shared entry point for the manual UI and a future authenticated scheduler.
export async function dailyWorkflow(
  db: Database,
  providers: { ai: AIProvider; intelligence: IntelligenceSourceProvider },
  zone: string,
) {
  const sync = await syncIntelligenceItems(db, providers.intelligence);
  const review = await runEditorialReview(db, providers.ai, zone);
  return { synced: sync.count, reviewId: review.id };
}
export function isReviewDue(now: Date, zone: string, configuredTime: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(configuredTime)) return false;
  return zonedInput(now, zone).slice(11) >= configuredTime;
}
