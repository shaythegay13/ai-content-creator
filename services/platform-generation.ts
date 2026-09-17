import { and, eq, ne, or, lt } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db/client';
import * as s from '../db/schema';
import type { AIProvider } from '../providers/contracts';
import { AIOutputError, type AIResult } from '../providers/contracts';
import { generate, retrieveContext } from './ai';
import { getGenerationSettings } from './generation-settings';
import { platformPrompt } from '../prompts/platforms';
import {
  assertPlatform,
  composePost,
  hashtagsIn,
  type DraftPlatform,
} from '../lib/platform-validation';
export const platformSelection = z
  .array(z.enum(['x', 'linkedin']))
  .min(1)
  .max(2)
  .transform((v) => [...new Set(v)]);
export async function draftPlatform(
  db: Database,
  provider: AIProvider,
  platform: DraftPlatform,
  source: string,
  action = 'Generate Draft',
  extra = '',
) {
  const settings = await getGenerationSettings(db);
  const prefs = settings[platform];
  const context = await retrieveContext(db, source);
  let correction = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: AIResult | undefined;
    try {
      response = await generate(
        db,
        provider,
        {
          json: true,
          tier: attempt ? 'fast' : 'primary',
          maxOutputTokens: platform === 'x' ? 1200 : 1600,
          messages: [
            {
              role: 'system',
              content: context + '\n' + platformPrompt(platform, prefs),
            },
            {
              role: 'user',
              content: JSON.stringify({
                task: 'platform-draft',
                platform,
                source,
                action,
                extra,
                hashtagPreferences: prefs,
                correction,
                lengthBudget:
                  platform === 'x'
                    ? {
                        finalWeightedLimit: 280,
                        bodyTargetWeightedCharacters: attempt ? 170 : 210,
                        finalTargetWeightedCharacters: attempt ? 220 : 260,
                        instruction: attempt
                          ? 'Shorten substantially. Do not aim at the 280 boundary. Preserve the single core idea, use simple punctuation, and leave generous room for hashtags.'
                          : 'Leave room for hashtags and two newline separators.',
                      }
                    : undefined,
              }),
            },
          ],
        },
        attempt ? 'platform-compression' : 'platform-generation',
      );
      const parsed = z
        .object({
          platform: z.literal(platform),
          body: z.string().trim().min(1),
          hashtags: z.array(z.string().regex(/^[\p{L}\p{N}_]+$/u)).max(10),
        })
        .parse(JSON.parse(response.text));
      const hashtags = [...new Set(parsed.hashtags)];
      for (const tag of hashtags) {
        if (hashtagsIn('#' + tag)[0] !== tag)
          throw new Error('Return valid text hashtags, not numeric-only tags.');
        const grounded: [RegExp, RegExp][] = [
          [
            /^(ai|artificialintelligence|machinelearning)$/i,
            /\bAI\b|artificial intelligence|machine learning/i,
          ],
          [
            /^(crypto|cryptocurrency|blockchain|defi)$/i,
            /crypto|blockchain|decentralized finance|\bdefi\b/i,
          ],
          [/^sportsbetting$/i, /sports|sportsbook|betting/i],
          [/^predictionmarkets?$/i, /prediction.market/i],
        ];
        if (
          grounded.some(
            ([label, evidence]) => label.test(tag) && !evidence.test(source),
          )
        )
          throw new Error(
            `Hashtag #${tag} is not grounded in the source idea. Choose tags describing its actual subject, ignoring unrelated profile topics.`,
          );
      }
      if (hashtagsIn(parsed.body).length)
        throw new Error('Put hashtags only in the hashtags array.');
      if (
        prefs.enabled &&
        (hashtags.length < prefs.min || hashtags.length > prefs.max)
      )
        throw new Error(`Return ${prefs.min}-${prefs.max} relevant hashtags.`);
      if (!prefs.enabled && hashtags.length)
        throw new Error('Return no hashtags.');
      const body = composePost(parsed.body, hashtags);
      assertPlatform(platform, body);
      return { body, hashtags };
    } catch (error) {
      if (!response && !(error instanceof AIOutputError)) throw error;
      const reason =
        error instanceof Error ? error.message : 'Invalid structured output';
      if (attempt === 2)
        throw new Error(
          `${platform.toUpperCase()} generation failed after 3 attempts: ${reason}`,
        );
      correction = `Previous response failed validation: ${reason}. Compress/rewrite complete sentences, preserve meaning, and return valid JSON. Never cut a sentence blindly. Previous response: ${response?.text.slice(0, 5000) || 'No valid JSON returned; generate afresh.'}`;
    }
  }
  throw new Error('Generation failed');
}
export async function generateVariant(
  db: Database,
  provider: AIProvider,
  postId: string,
  platform: DraftPlatform,
  regenerate = false,
) {
  const [post] = await db
    .select()
    .from(s.contentPosts)
    .where(eq(s.contentPosts.id, postId));
  if (!post) throw new Error('Post not found');
  await db
    .insert(s.contentPostVariants)
    .values({ postId, platform, body: '' })
    .onConflictDoNothing();
  const [original] = await db
    .select()
    .from(s.contentPostVariants)
    .where(
      and(
        eq(s.contentPostVariants.postId, postId),
        eq(s.contentPostVariants.platform, platform),
      ),
    );
  if (original.generationStatus === 'succeeded' && !regenerate) return original;
  const [claimed] = await db
    .update(s.contentPostVariants)
    .set({
      generationStatus: 'generating',
      generationError: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(s.contentPostVariants.id, original.id),
        or(
          ne(s.contentPostVariants.generationStatus, 'generating'),
          lt(
            s.contentPostVariants.updatedAt,
            new Date(Date.now() - 10 * 60000),
          ),
        ),
      ),
    )
    .returning();
  if (!claimed) return original;
  try {
    const draft = await draftPlatform(
      db,
      provider,
      platform,
      [post.title, post.coreIdea, post.notes].filter(Boolean).join('\n'),
      regenerate ? 'Regenerate' : 'Generate Draft',
    );
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(s.contentPostVariants)
        .where(eq(s.contentPostVariants.id, original.id));
      if (
        original.body.trim() ||
        current.body !== original.body ||
        regenerate
      ) {
        await tx.insert(s.suggestions).values({
          variantId: original.id,
          original: original.body,
          suggested: draft.body,
          action: 'Regenerate ' + platform,
          evidence: { hashtags: draft.hashtags },
        });
      } else {
        await tx
          .update(s.contentPostVariants)
          .set({ ...draft, status: 'draft', approvedAt: null })
          .where(
            and(
              eq(s.contentPostVariants.id, original.id),
              eq(s.contentPostVariants.body, original.body),
            ),
          );
      }
      await tx
        .update(s.contentPostVariants)
        .set({
          generationStatus: 'succeeded',
          generationError: null,
          updatedAt: new Date(),
        })
        .where(eq(s.contentPostVariants.id, original.id));
    });
  } catch (error) {
    await db
      .update(s.contentPostVariants)
      .set({
        generationStatus: 'failed',
        generationError:
          error instanceof Error ? error.message : 'Generation failed. Retry.',
        updatedAt: new Date(),
      })
      .where(eq(s.contentPostVariants.id, original.id));
  }
  const [result] = await db
    .select()
    .from(s.contentPostVariants)
    .where(eq(s.contentPostVariants.id, original.id));
  return result;
}
export async function initializeVariants(
  db: Database,
  provider: AIProvider,
  postId: string,
  platforms: DraftPlatform[] = ['x', 'linkedin'],
) {
  const settings = await getGenerationSettings(db);
  for (const platform of platformSelection.parse(platforms)) {
    await db
      .insert(s.contentPostVariants)
      .values({ postId, platform, body: '' })
      .onConflictDoNothing();
    if (settings.autoGenerate)
      await generateVariant(db, provider, postId, platform);
  }
}
