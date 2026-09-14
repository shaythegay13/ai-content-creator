'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db/client';
import * as s from '@/db/schema';
import { requireUser } from '@/services/authentication';
import { createContentSchema, validateUpload } from '@/services/validation';
import { createMockReview } from '@/services/editorial';
import { providers } from '@/providers';
import { timezone } from '@/lib/config';
export type ActionState = { ok: boolean; message: string };
const refresh = () => revalidatePath('/', 'layout');
export async function createContent(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const user = await requireUser();
    const input = createContentSchema.parse(Object.fromEntries(form));
    const db = await getDb();
    if (input.kind === 'idea')
      await db
        .insert(s.contentIdeas)
        .values({ userId: user.id, title: input.title, rawNote: input.body });
    else
      await db.transaction(async (tx) => {
        const [post] = await tx
          .insert(s.contentPosts)
          .values({ userId: user.id, title: input.title })
          .returning();
        await tx.insert(s.contentPostVariants).values(
          (input.platform === 'both'
            ? ['x', 'linkedin']
            : [input.platform]
          ).map((platform) => ({
            postId: post.id,
            platform,
            body: input.body,
          })),
        );
      });
    refresh();
    return {
      ok: true,
      message:
        input.kind === 'idea'
          ? 'Idea saved to your inbox.'
          : 'Draft saved with linked platform variants.',
    };
  } catch {
    return {
      ok: false,
      message:
        'Could not save. Add a title (3–240 characters) and content (1–20,000 characters).',
    };
  }
}
export async function uploadMedia(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const user = await requireUser();
    const file = form.get('file');
    if (!(file instanceof File)) throw new Error('Select a file.');
    validateUpload(file.size, file.type);
    const storage = providers().storage;
    const key = await storage.put(
      new Uint8Array(await file.arrayBuffer()),
      file.name,
    );
    try {
      const db = await getDb();
      await db.insert(s.mediaAssets).values({
        userId: user.id,
        kind: file.type.split('/')[0],
        filename: file.name,
        storageKey: key,
        mimeType: file.type,
        size: file.size,
        description: String(form.get('description') || '').slice(0, 2000),
      });
    } catch (error) {
      await storage.delete(key);
      throw error;
    }
    refresh();
    return { ok: true, message: 'Media uploaded and saved locally.' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Upload failed.',
    };
  }
}
export async function runReview() {
  await requireUser();
  await createMockReview(await getDb(), timezone());
  refresh();
}
export async function syncIntelligence() {
  await requireUser();
  const db = await getDb();
  const items = await providers().intelligence.fetch();
  for (const item of items)
    await db.insert(s.intelligenceItems).values(item).onConflictDoNothing();
  refresh();
}
export async function recordDecision(form: FormData) {
  const user = await requireUser();
  const postReviewId = z.uuid().parse(form.get('id'));
  const decision = z
    .enum(['accepted', 'rejected', 'edited', 'ignored'])
    .parse(form.get('decision'));
  const db = await getDb();
  await db.insert(s.recommendationDecisions).values({
    postReviewId,
    userId: user.id,
    decision,
    note: 'User recorded a decision. No text was changed or published.',
  });
  refresh();
}
export async function saveProfile(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const user = await requireUser();
    const tone = z.string().trim().min(1).max(500).parse(form.get('tone'));
    const instructions = z.string().max(5000).parse(form.get('instructions'));
    const db = await getDb();
    await db
      .update(s.writingProfiles)
      .set({ tone, personalInstructions: instructions, updatedAt: new Date() })
      .where(eq(s.writingProfiles.userId, user.id));
    refresh();
    return { ok: true, message: 'Writing preferences saved.' };
  } catch {
    return {
      ok: false,
      message: 'Add a tone and keep instructions under 5,000 characters.',
    };
  }
}
export async function chat(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const user = await requireUser();
    const prompt = z.string().trim().min(1).max(8000).parse(form.get('prompt'));
    const result = await providers().ai.generate(prompt);
    const db = await getDb();
    await db.transaction(async (tx) => {
      const [conversation] = await tx
        .insert(s.aiConversations)
        .values({ userId: user.id, title: prompt.slice(0, 100) })
        .returning();
      await tx.insert(s.aiMessages).values([
        { conversationId: conversation.id, role: 'user', content: prompt },
        {
          conversationId: conversation.id,
          role: 'assistant',
          content: result.text,
        },
      ]);
      await tx.insert(s.aiUsage).values({
        conversationId: conversation.id,
        provider: providers().ai.name,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      });
    });
    refresh();
    return { ok: true, message: 'Mock response saved.' };
  } catch {
    return { ok: false, message: 'Enter a prompt of 1–8,000 characters.' };
  }
}
