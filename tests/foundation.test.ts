import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as s from '../db/schema';
import { seed } from '../db/seed';
import { createMockReview, dayKey } from '../services/editorial';
import { createContentSchema, validateUpload } from '../services/validation';
import {
  MockSocialPublisher,
  MockAIProvider,
  DEV_USER_ID,
} from '../providers/mocks';
import { LocalMediaStorageProvider } from '../providers/storage';
const client = new PGlite();
const db = drizzle(client, { schema: s });
beforeAll(async () => {
  await migrate(db, { migrationsFolder: 'drizzle' });
  await seed(db);
});
afterAll(async () => {
  await client.close();
});
describe('PostgreSQL foundation', () => {
  it('migrates and seeds realistic linked content idempotently', async () => {
    await seed(db);
    expect(await db.select().from(s.users)).toHaveLength(1);
    expect(await db.select().from(s.contentPosts)).toHaveLength(6);
    const variants = await db.select().from(s.contentPostVariants);
    expect(variants).toHaveLength(12);
    expect(new Set(variants.map((v) => v.postId)).size).toBe(6);
    expect(await db.select().from(s.intelligenceItems)).toHaveLength(3);
  });
  it('enforces one variant per platform per concept', async () => {
    const [v] = await db.select().from(s.contentPostVariants);
    await expect(
      db
        .insert(s.contentPostVariants)
        .values({ postId: v.postId, platform: v.platform, body: 'duplicate' }),
    ).rejects.toThrow();
  });
  it('cascades post deletion to variants', async () => {
    const [post] = await db
      .insert(s.contentPosts)
      .values({ userId: DEV_USER_ID, title: 'Cascade test' })
      .returning();
    await db.insert(s.contentPostVariants).values({
      postId: post.id,
      platform: 'threads',
      body: 'Future platforms work',
    });
    await db.delete(s.contentPosts).where(eq(s.contentPosts.id, post.id));
    expect(
      await db
        .select()
        .from(s.contentPostVariants)
        .where(eq(s.contentPostVariants.postId, post.id)),
    ).toHaveLength(0);
  });
  it('preserves original text and evidence, and never publishes during review', async () => {
    const before = await db.select().from(s.contentPostVariants);
    const publishedBefore = await db.select().from(s.publishedPosts);
    await createMockReview(db, 'America/New_York');
    await createMockReview(db, 'America/New_York');
    expect(await db.select().from(s.dailyEditorialReviews)).toHaveLength(1);
    const reviews = await db.select().from(s.dailyEditorialPostReviews);
    expect(reviews).toHaveLength(2);
    expect(reviews[0].originalText.length).toBeGreaterThan(20);
    expect(reviews[0].evidenceSnapshot).toBeTruthy();
    await db.insert(s.recommendationDecisions).values({
      postReviewId: reviews[0].id,
      userId: DEV_USER_ID,
      decision: 'accepted',
    });
    expect(await db.select().from(s.contentPostVariants)).toEqual(before);
    expect(await db.select().from(s.publishedPosts)).toEqual(publishedBefore);
  });
});
describe('provider and input boundaries', () => {
  it('requires approval even for simulated publishing', async () => {
    const p = new MockSocialPublisher();
    await expect(p.publish({ approved: false })).rejects.toThrow('approval');
    expect((await p.publish({ approved: true })).simulated).toBe(true);
  });
  it('labels mock AI and records no billed tokens', async () => {
    const result = await new MockAIProvider().generate('Founder lessons');
    expect(result.text).toContain('Mock');
    expect(result.outputTokens).toBe(0);
  });
  it('validates content and uploads', () => {
    expect(
      createContentSchema.safeParse({ kind: 'post', title: 'Hi', body: '' })
        .success,
    ).toBe(false);
    expect(() => validateUpload(21 * 1024 * 1024, 'image/png')).toThrow();
    expect(() => validateUpload(100, 'text/html')).toThrow();
    expect(() => validateUpload(10, 'image/svg+xml')).toThrow();
    expect(() => validateUpload(100, 'image/png')).not.toThrow();
  });
  it('stores exact bytes and rejects traversal', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'fieldnotes-'));
    try {
      const storage = new LocalMediaStorageProvider(root);
      const bytes = new Uint8Array([1, 2, 3]);
      const key = await storage.put(bytes, '../../example.png');
      expect(new Uint8Array(await storage.get(key))).toEqual(bytes);
      await expect(storage.get('../secret')).rejects.toThrow('Invalid');
      await storage.delete(key);
      await expect(storage.get(key)).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it('uses the configured timezone across midnight and DST', () => {
    expect(dayKey(new Date('2026-09-14T02:00:00Z'), 'America/New_York')).toBe(
      '2026-09-13',
    );
    expect(dayKey(new Date('2026-03-08T07:30:00Z'), 'America/New_York')).toBe(
      '2026-03-08',
    );
  });
});
