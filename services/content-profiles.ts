import { z } from 'zod';
import type { Database } from '../db/client';
import * as s from '../db/schema';
import { profileFields } from '../lib/content-profiles';
export async function saveContentProfile(db: Database, input: unknown) {
  const parsed = z
    .object({
      kind: z.enum(['user', 'company', 'strategy', 'preferences']),
      fields: z.record(z.string(), z.string().max(2000)),
    })
    .parse(input);
  const fields = Object.fromEntries(
    profileFields[parsed.kind].map((key) => [
      key,
      parsed.fields[key]?.trim() || '',
    ]),
  );
  const [row] = await db
    .insert(s.contentProfiles)
    .values({ kind: parsed.kind, fields })
    .onConflictDoUpdate({
      target: s.contentProfiles.kind,
      set: { fields, updatedAt: new Date() },
    })
    .returning();
  return row;
}
