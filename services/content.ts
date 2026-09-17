import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db/client';
import * as s from '../db/schema';
import { localDateTime } from '../lib/time';
import {
  assertPlatform,
  hashtagsIn,
  type DraftPlatform,
} from '../lib/platform-validation';
import { initializeVariants, platformSelection } from './platform-generation';
import type { AIProvider } from '../providers/contracts';
import { MockAIProvider } from '../providers/mocks';
const id = z.uuid();
const text = z.string().max(30000);
const tags = z.array(z.string().max(120)).max(100).default([]);
const status = z.enum([
  'idea',
  'draft',
  'review',
  'ready',
  'scheduled',
  'published',
  'archived',
]);
export const postInput = z.object({
  id: id.optional(),
  title: z.string().trim().min(1).max(240),
  coreIdea: text.default(''),
  pillar: z.string().max(240).default(''),
  notes: text.default(''),
  sourceReferences: z.array(z.url()).default([]),
  status: status.default('draft'),
});
export const ideaInput = z.object({
  id: id.optional(),
  title: z.string().trim().min(1).max(240),
  rawNote: text.default(''),
  source: z.string().max(100).default('manual'),
  topicId: id.nullable().default(null),
  tags,
  priority: z.number().int().min(1).max(3).default(2),
  sourceUrl: z.union([z.url(), z.literal('')]).default(''),
  status: z
    .enum(['inbox', 'developing', 'converted', 'archived'])
    .default('inbox'),
  createdAt: z.coerce.date().optional(),
  mediaIds: z.array(id).default([]),
});
export async function savePost(db: Database, userId: string, input: unknown) {
  const p = postInput.parse(input);
  if (p.status === 'published') throw new Error('Publishing is disabled.');
  if (p.id) {
    const [row] = await db
      .update(s.contentPosts)
      .set({ ...p, updatedAt: new Date() })
      .where(
        and(eq(s.contentPosts.id, p.id), eq(s.contentPosts.userId, userId)),
      )
      .returning();
    if (!row) throw new Error('Post not found');
    if (p.status === 'archived') await archiveOrDelete(db, p.id, 'archive');
    return row;
  }
  const [row] = await db
    .insert(s.contentPosts)
    .values({ ...p, userId })
    .returning();
  return row;
}
export async function saveIdea(db: Database, userId: string, input: unknown) {
  const { mediaIds, ...p } = ideaInput.parse(input);
  return db.transaction(async (tx) => {
    let row;
    if (p.id) {
      [row] = await tx
        .update(s.contentIdeas)
        .set({ ...p, updatedAt: new Date() })
        .where(
          and(eq(s.contentIdeas.id, p.id), eq(s.contentIdeas.userId, userId)),
        )
        .returning();
    } else {
      [row] = await tx
        .insert(s.contentIdeas)
        .values({ ...p, userId })
        .returning();
    }
    if (!row) throw new Error('Idea not found');
    await tx
      .delete(s.ideaMediaRelations)
      .where(eq(s.ideaMediaRelations.ideaId, row.id));
    if (mediaIds.length)
      await tx.insert(s.ideaMediaRelations).values(
        [...new Set(mediaIds)].map((mediaId) => ({
          ideaId: row.id,
          mediaId,
        })),
      );
    return row;
  });
}
export async function saveVariant(db: Database, input: unknown) {
  const p = z
    .object({
      id: id.optional(),
      postId: id,
      platform: z.enum(['x', 'linkedin']),
      body: text,
      status: status.default('draft'),
    })
    .parse(input);
  if (p.status === 'published') throw new Error('Publishing is disabled.');
  if (p.body.trim() || ['ready', 'scheduled'].includes(p.status))
    assertPlatform(p.platform, p.body);
  return db.transaction(async (tx) => {
    if (p.status === 'scheduled') {
      if (!p.id) throw new Error('Create the variant before scheduling it.');
      const entries = await tx
        .select()
        .from(s.contentCalendarEntries)
        .where(eq(s.contentCalendarEntries.variantId, p.id));
      if (!entries.length) throw new Error('Set a scheduled time first.');
    }
    const [row] = p.id
      ? await tx
          .update(s.contentPostVariants)
          .set({
            ...p,
            hashtags: hashtagsIn(p.body),
            approvedAt: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(s.contentPostVariants.id, p.id),
              eq(s.contentPostVariants.postId, p.postId),
            ),
          )
          .returning()
      : await tx
          .insert(s.contentPostVariants)
          .values({ ...p, hashtags: hashtagsIn(p.body) })
          .returning();
    if (!row) throw new Error('Variant not found');
    if (p.status !== 'scheduled')
      await tx
        .delete(s.contentCalendarEntries)
        .where(eq(s.contentCalendarEntries.variantId, row.id));
    return row;
  });
}
export async function scheduleVariant(db: Database, input: unknown) {
  const p = z
    .object({ variantId: id, localTime: z.string(), timezone: z.string() })
    .parse(input);
  const at = localDateTime(p.localTime, p.timezone);
  return db.transaction(async (tx) => {
    const [saved] = await tx
      .select()
      .from(s.contentPostVariants)
      .where(eq(s.contentPostVariants.id, p.variantId));
    if (!saved) throw new Error('Variant not found');
    assertPlatform(saved.platform, saved.body);
    const [variant] = await tx
      .update(s.contentPostVariants)
      .set({ status: 'scheduled', updatedAt: new Date() })
      .where(eq(s.contentPostVariants.id, p.variantId))
      .returning();
    if (!variant) throw new Error('Variant not found');
    await tx
      .update(s.contentPosts)
      .set({ status: 'scheduled', updatedAt: new Date() })
      .where(eq(s.contentPosts.id, variant.postId));
    const [entry] = await tx
      .insert(s.contentCalendarEntries)
      .values({ variantId: p.variantId, scheduledAt: at, timezone: p.timezone })
      .onConflictDoUpdate({
        target: s.contentCalendarEntries.variantId,
        set: { scheduledAt: at, timezone: p.timezone, updatedAt: new Date() },
      })
      .returning();
    return entry;
  });
}
export async function duplicatePost(
  db: Database,
  userId: string,
  postId: string,
) {
  return db.transaction(async (tx) => {
    const [post] = await tx
      .select()
      .from(s.contentPosts)
      .where(eq(s.contentPosts.id, id.parse(postId)));
    if (!post) throw new Error('Post not found');
    const [copy] = await tx
      .insert(s.contentPosts)
      .values({
        userId,
        title: `${post.title} (copy)`,
        coreIdea: post.coreIdea,
        pillar: post.pillar,
        notes: post.notes,
        sourceReferences: post.sourceReferences,
        status: 'draft',
      })
      .returning();
    const variants = await tx
      .select()
      .from(s.contentPostVariants)
      .where(eq(s.contentPostVariants.postId, post.id));
    if (variants.length)
      await tx.insert(s.contentPostVariants).values(
        variants.map((v) => ({
          postId: copy.id,
          platform: v.platform,
          body: v.body,
          status: 'draft' as const,
        })),
      );
    const media = await tx
      .select()
      .from(s.mediaPostRelations)
      .where(eq(s.mediaPostRelations.postId, post.id));
    if (media.length)
      await tx
        .insert(s.mediaPostRelations)
        .values(media.map((m) => ({ postId: copy.id, mediaId: m.mediaId })));
    return copy;
  });
}
export async function attachMedia(
  db: Database,
  postId: string,
  mediaIds: string[],
) {
  id.parse(postId);
  z.array(id).parse(mediaIds);
  await db.transaction(async (tx) => {
    const old = await tx
      .select()
      .from(s.mediaPostRelations)
      .where(eq(s.mediaPostRelations.postId, postId));
    await tx
      .delete(s.mediaPostRelations)
      .where(eq(s.mediaPostRelations.postId, postId));
    if (mediaIds.length)
      await tx
        .insert(s.mediaPostRelations)
        .values([...new Set(mediaIds)].map((mediaId) => ({ postId, mediaId })));
    const affected = [...new Set([...old.map((m) => m.mediaId), ...mediaIds])];
    for (const mediaId of affected) {
      const used = await tx
        .select()
        .from(s.mediaPostRelations)
        .where(eq(s.mediaPostRelations.mediaId, mediaId));
      await tx
        .update(s.mediaAssets)
        .set({
          usageStatus: used.length ? 'used' : 'unused',
          updatedAt: new Date(),
        })
        .where(eq(s.mediaAssets.id, mediaId));
    }
  });
  return { attached: mediaIds.length };
}
export async function convertIdea(
  db: Database,
  userId: string,
  ideaId: string,
  platforms: DraftPlatform[] | DraftPlatform = ['x', 'linkedin'],
  provider: AIProvider = new MockAIProvider(),
) {
  const selected = platformSelection.parse(
    typeof platforms === 'string' ? [platforms] : platforms,
  );
  const post = await db.transaction(async (tx) => {
    const db = tx as unknown as Database;
    const [idea] = await db
      .select()
      .from(s.contentIdeas)
      .where(eq(s.contentIdeas.id, id.parse(ideaId)));
    if (!idea) throw new Error('Idea not found');
    const post = await savePost(db, userId, {
      title: idea.title,
      coreIdea: idea.rawNote,
    });
    await db
      .update(s.contentPosts)
      .set({ ideaId: idea.id })
      .where(eq(s.contentPosts.id, post.id));
    const media = await db
      .select()
      .from(s.ideaMediaRelations)
      .where(eq(s.ideaMediaRelations.ideaId, idea.id));
    await attachMedia(
      db,
      post.id,
      media.map((m) => m.mediaId),
    );
    await db
      .update(s.contentIdeas)
      .set({ status: 'converted', updatedAt: new Date() })
      .where(eq(s.contentIdeas.id, idea.id));
    return post;
  });
  await initializeVariants(db, provider, post.id, selected);
  return post;
}
export async function archiveOrDelete(
  db: Database,
  postId: string,
  mode: 'archive' | 'delete',
) {
  id.parse(postId);
  if (mode === 'delete') {
    await attachMedia(db, postId, []);
    await db.delete(s.contentPosts).where(eq(s.contentPosts.id, postId));
  } else {
    await db.transaction(async (tx) => {
      await tx
        .update(s.contentPosts)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(eq(s.contentPosts.id, postId));
      const variants = await tx
        .update(s.contentPostVariants)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(eq(s.contentPostVariants.postId, postId))
        .returning();
      if (variants.length)
        await tx.delete(s.contentCalendarEntries).where(
          inArray(
            s.contentCalendarEntries.variantId,
            variants.map((v) => v.id),
          ),
        );
    });
  }
  return { done: true };
}
