import { and, eq, ne, or, lt } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db/client';
import * as s from '../db/schema';
import type { AIProvider, AIRequest } from '../providers/contracts';
import { AIOutputError, type AIResult } from '../providers/contracts';
import { generate, retrieveContext } from './ai';
import { getGenerationSettings } from './generation-settings';
import { platformPrompt } from '../prompts/platforms';
import {
  brainSystem,
  prepareBrief,
  critiqueDraft,
  type PreparedBrief,
} from './content-brain';
import { repetitionScore } from './content-context';
import { excerpt, compactData, estimateTokens } from '../lib/ai-budget';
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
  prepared?: PreparedBrief,
) {
  const settings = await getGenerationSettings(db);
  const prefs = settings[platform];
  const context = prepared
    ? brainSystem +
      '\nStrategic brief: ' +
      JSON.stringify(compactData(prepared.brief, 180)) +
      '\nRelevant context: ' +
      JSON.stringify({
        ...prepared.context,
        records: prepared.context.records.map((r) => ({
          ...r,
          text: excerpt(r.text, 260),
        })),
      })
    : await retrieveContext(db, source);
  let correction = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: AIResult | undefined;
    try {
      const request: AIRequest = {
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
              source: prepared ? excerpt(source, 2800) : source,
              action,
              extra: prepared ? excerpt(extra, 1400) : extra,
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
      };
      if (prepared) {
        const records = prepared.context.records.map((r) => ({
          ...r,
          text: excerpt(r.text, 180),
        }));
        while (
          estimateTokens({ messages: request.messages }) +
            request.maxOutputTokens! >
            5800 &&
          records.length
        ) {
          records.pop();
          request.messages[0].content =
            brainSystem +
            '\nStrategic brief: ' +
            JSON.stringify(compactData(prepared.brief, 180)) +
            '\nRelevant context: ' +
            JSON.stringify({ ...prepared.context, records }) +
            '\n' +
            platformPrompt(platform, prefs);
        }
      }
      response = await generate(
        db,
        provider,
        request,
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
      correction = `Previous response failed validation: ${reason}. Compress/rewrite complete sentences, preserve meaning, and return valid JSON. Never cut a sentence blindly. Previous response: ${response?.text.slice(0, 1100) || 'No valid JSON returned; generate afresh.'}`;
    }
  }
  throw new Error('Generation failed');
}
export async function strategicDraft(
  db: Database,
  provider: AIProvider,
  platform: DraftPlatform,
  source: string,
  postId?: string,
  action = 'Generate Draft',
  extra = '',
) {
  const prepared = await prepareBrief(db, provider, source, postId, action);
  let draft = await draftPlatform(
    db,
    provider,
    platform,
    source,
    action,
    extra,
    prepared,
  );
  const critique = await critiqueDraft(
    db,
    provider,
    prepared,
    platform,
    source,
    draft.body,
  );
  if (
    critique.scores.overallInterest <= 2 ||
    critique.scores.clarity <= 2 ||
    critique.scores.authenticity <= 2
  )
    critique.materialWeakness = true;
  const repeated = prepared.context.records.filter(
    (r) =>
      r.type === 'recentPost' && repetitionScore(draft.body, r.text) >= 0.8,
  );
  if (repeated.length) {
    critique.materialWeakness = true;
    critique.issues.push(
      'Draft substantially repeats recent content. Choose a more distinct implication.',
    );
    critique.scores.nonRepetition = 1;
  }
  if (repetitionScore(draft.body, source) >= 0.9) {
    critique.materialWeakness = true;
    critique.issues.push(
      'Draft largely repeats the source wording. Rebuild around the brief takeaway.',
    );
  }
  const revised =
    critique.materialWeakness || critique.unsupportedClaims.length > 0;
  if (revised)
    draft = await draftPlatform(
      db,
      provider,
      platform,
      source,
      action,
      extra +
        '\nRevise once to resolve this critique: ' +
        JSON.stringify({
          issues: critique.issues,
          unsupportedClaims: [...new Set(critique.unsupportedClaims)],
          instruction:
            'Remove unsupported claims completely; do not merely add qualifiers or attribute them to an invented conversation. Preserve the source tension and use a useful conditional implication.',
        }) +
        '\nPrior draft: ' +
        draft.body,
      prepared,
    );
  // If a factual defect was found, do not assume that rewriting resolved it.
  // One final audit may reject the result; it never starts another revision loop.
  const finalCheck = critique.unsupportedClaims.length
    ? await critiqueDraft(db, provider, prepared, platform, source, draft.body)
    : null;
  await db.insert(s.draftAssessments).values({
    briefId: prepared.id,
    platform,
    draft: draft.body,
    critique: { ...critique, finalCheck },
    revised,
  });
  if (finalCheck?.unsupportedClaims.length)
    throw new Error(
      'The revised draft still contains unsupported claims. Review the source or retry; existing text was preserved.',
    );
  return draft;
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
  const heartbeat = setInterval(() => {
    void db
      .update(s.contentPostVariants)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(s.contentPostVariants.id, original.id),
          eq(s.contentPostVariants.generationStatus, 'generating'),
        ),
      )
      .catch(() => {});
  }, 60000);
  try {
    const draft = await strategicDraft(
      db,
      provider,
      platform,
      [post.title, post.coreIdea, post.notes].filter(Boolean).join('\n'),
      post.id,
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
  } finally {
    clearInterval(heartbeat);
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
