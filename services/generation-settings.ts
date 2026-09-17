import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db/client';
import { appSettings } from '../db/schema';
const tags = z
  .object({
    enabled: z.boolean(),
    min: z.number().int().min(0).max(10),
    max: z.number().int().min(0).max(10),
  })
  .refine((v) => v.min <= v.max, 'Minimum must not exceed maximum');
export const generationSettingsSchema = z.object({
  autoGenerate: z.boolean(),
  x: tags,
  linkedin: tags,
});
export const defaultGenerationSettings = {
  autoGenerate: true,
  x: { enabled: true, min: 1, max: 2 },
  linkedin: { enabled: true, min: 3, max: 5 },
};
export async function getGenerationSettings(db: Database) {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, 'post-generation'));
  return generationSettingsSchema.parse(
    row?.value ?? {
      ...defaultGenerationSettings,
      autoGenerate: process.env.AUTO_GENERATE_POST_VARIANTS !== 'false',
    },
  );
}
export async function saveGenerationSettings(db: Database, value: unknown) {
  const parsed = generationSettingsSchema.parse(value);
  await db
    .insert(appSettings)
    .values({ key: 'post-generation', value: parsed })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: parsed, updatedAt: new Date() },
    });
  return parsed;
}
