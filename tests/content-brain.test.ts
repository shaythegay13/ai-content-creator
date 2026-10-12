import { beforeAll, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import * as s from '../db/schema';
import { seed } from '../db/seed';
import { DEV_USER_ID, MockAIProvider } from '../providers/mocks';
import type { AIRequest, AIProvider } from '../providers/contracts';
import { saveContentProfile } from '../services/content-profiles';
import {
  ContentContextService,
  repetitionScore,
  performancePatterns,
} from '../services/content-context';
import {
  ingestKnowledge,
  prepareBrief,
  critiqueDraft,
  saveIdeaWithKnowledge,
  savePostWithKnowledge,
} from '../services/content-brain';
import { strategicDraft, draftPlatform } from '../services/platform-generation';
import { savePost, saveIdea, convertIdea } from '../services/content';
import { validatePlatform } from '../lib/platform-validation';
import { requestBudget } from '../lib/ai-budget';
const client = new PGlite();
const db = drizzle(client, { schema: s });
const mock = new MockAIProvider();
const note =
  'Talked to someone today. They said prediction markets care about different users than sportsbooks. Could be interesting for PlayMind.';
beforeAll(async () => {
  await migrate(db, { migrationsFolder: 'drizzle' });
  await seed(db);
});
afterAll(() => client.close());
function recording() {
  const calls: AIRequest[] = [];
  const provider: AIProvider = {
    name: 'mock',
    generate: mock.generate.bind(mock),
    complete: async (r) => {
      calls.push(r);
      requestBudget(r);
      return mock.complete(r);
    },
  };
  return { calls, provider };
}
it('supports missing profiles without inventing persistent company context', async () => {
  const prepared = await prepareBrief(
    db,
    mock,
    'A useful operator question about onboarding.',
  );
  expect(prepared.context.missing).toContain('company');
  expect(await db.select().from(s.contentProfiles)).toHaveLength(0);
  expect(prepared.context.performanceNote).toContain('Insufficient');
});
it('keeps newly supplied notes when ingestion is unavailable', async () => {
  const unavailable: AIProvider = {
    name: 'offline',
    generate: async () => {
      throw new Error('Unavailable');
    },
    complete: async () => {
      throw new Error('Unavailable');
    },
  };
  const idea = await saveIdeaWithKnowledge(
    db,
    DEV_USER_ID,
    { title: 'Preserve idea', rawNote: note },
    unavailable,
  );
  const post = await savePostWithKnowledge(
    db,
    DEV_USER_ID,
    { title: 'Preserve post', coreIdea: note },
    unavailable,
  );
  expect(idea.knowledgeError).toBe('Unavailable');
  expect(post.knowledgeError).toBe('Unavailable');
  expect(
    (
      await db
        .select()
        .from(s.contentIdeas)
        .where(eq(s.contentIdeas.id, idea.id))
    )[0].rawNote,
  ).toBe(note);
  expect(
    (
      await db
        .select()
        .from(s.contentPosts)
        .where(eq(s.contentPosts.id, post.id))
    )[0].coreIdea,
  ).toBe(note);
});
it('persists source-grounded knowledge with inference distinct and caches unchanged source', async () => {
  const { calls, provider } = recording();
  const rows = await ingestKnowledge(db, provider, note, 'fixture:industry');
  expect(
    rows.some((r) => r.kind === 'insight' && r.confidence === 'inference'),
  ).toBe(true);
  expect(rows.every((r) => note.includes(r.evidence))).toBe(true);
  await ingestKnowledge(db, provider, note, 'fixture:industry');
  expect(calls).toHaveLength(1);
  expect(rows.map((r) => r.statement).join(' ')).toContain('motivations');
});
it('retrieves relevant knowledge and source-linked intelligence, excludes unrelated knowledge', async () => {
  await db.insert(s.knowledgeItems).values({
    sourceKey: 'irrelevant',
    sourceHash: 'x',
    kind: 'fact',
    statement: 'Orchid roots require airy substrate.',
    confidence: 'user_claim',
    evidence: 'Orchid roots',
    entities: [],
    themes: [],
  });
  const [intel] = await db
    .insert(s.intelligenceItems)
    .values({
      source: 'notion',
      externalId: 'brain-test',
      title: 'Prediction market participant motivation',
      summary: 'Research describes different participant jobs.',
      category: 'research',
      sourceUrl: 'https://example.org/source',
      publishedAt: new Date(),
    })
    .returning();
  const context = await new ContentContextService(db).assemble(note);
  expect(
    context.records.some(
      (r) => r.type === 'knowledge' && r.text.includes('motivations'),
    ),
  ).toBe(true);
  expect(JSON.stringify(context)).not.toContain('Orchid');
  expect(context.records.find((r) => r.id === intel.id)?.sourceUrl).toBe(
    'https://example.org/source',
  );
});
it('feeds company, strategy and writing profiles into the brief, then transforms the note for each platform', async () => {
  await saveContentProfile(db, {
    kind: 'company',
    fields: {
      name: 'PlayMind',
      description: 'Tools for understanding operator customer behavior',
      approvedClaims: 'No proven cross-market outcome claims.',
    },
  });
  await saveContentProfile(db, {
    kind: 'strategy',
    fields: {
      primaryGoals: 'Build credibility through useful operator insight',
      targetAudiences: 'Operators and founders',
      promotionLevel: 'Low',
    },
  });
  await saveContentProfile(db, {
    kind: 'user',
    fields: {
      role: 'Founder',
      publicPersonalContext: 'Only anecdotes explicitly supplied in notes',
    },
  });
  const { calls, provider } = recording();
  const idea = await saveIdea(db, DEV_USER_ID, {
    title: 'Different customer jobs',
    rawNote: note,
  });
  const post = await convertIdea(
    db,
    DEV_USER_ID,
    idea.id,
    ['x', 'linkedin'],
    provider,
  );
  const variants = await db
    .select()
    .from(s.contentPostVariants)
    .where(eq(s.contentPostVariants.postId, post.id));
  expect(variants.every((v) => v.generationStatus === 'succeeded')).toBe(true);
  const x = variants.find((v) => v.platform === 'x')!;
  const li = variants.find((v) => v.platform === 'linkedin')!;
  expect(x.body).not.toContain('Talked to someone today');
  expect(x.body).toContain('customer jobs');
  expect(li.body).toContain('hypothesis');
  expect(li.body).not.toContain('proven results');
  expect(li.body.startsWith(x.body.split('\n')[0])).toBe(false);
  expect(validatePlatform('x', x.body).valid).toBe(true);
  expect(x.hashtags.length).toBeGreaterThan(0);
  expect(li.hashtags.length).toBeGreaterThanOrEqual(3);
  const briefCalls = calls.filter(
    (r) => JSON.parse(r.messages.at(-1)!.content!).task === 'content-brief',
  );
  expect(briefCalls).toHaveLength(1); // shared understanding, not duplicate primary calls per platform
  const input = briefCalls[0].messages.at(-1)!.content;
  expect(input).toContain('PlayMind');
  expect(input).toContain('Build credibility');
  expect(input).toContain('writingProfile');
  const [brief] = await db
    .select()
    .from(s.contentBriefs)
    .where(eq(s.contentBriefs.postId, post.id));
  expect(brief.brief.strongestAngle).toBeTruthy();
  expect(brief.brief.platformExecution).toHaveProperty('x');
  expect(brief.context).toHaveProperty('records');
  expect(
    (
      await db
        .select()
        .from(s.contentIdeas)
        .where(eq(s.contentIdeas.id, idea.id))
    )[0].rawNote,
  ).toBe(note);
});
it('material critique triggers exactly one revision and records the explanation', async () => {
  const post = await savePost(db, DEV_USER_ID, {
    title: 'Critic fixture',
    coreIdea: note,
  });
  const calls: string[] = [];
  const provider: AIProvider = {
    name: 'critic-test',
    generate: mock.generate.bind(mock),
    complete: async (r) => {
      const task = JSON.parse(r.messages.at(-1)!.content!).task;
      calls.push(task);
      const result = await mock.complete(r);
      if (task === 'draft-critique')
        result.text = JSON.stringify({
          ...JSON.parse(result.text),
          materialWeakness: true,
          issues: ['Opening is generic.'],
          summary: 'Strengthen the comparison hook.',
        });
      return result;
    },
  };
  await strategicDraft(db, provider, 'x', note, post.id);
  expect(calls.filter((t) => t === 'draft-critique')).toHaveLength(1);
  expect(calls.filter((t) => t === 'platform-draft')).toHaveLength(2);
  const brief = (
    await db
      .select()
      .from(s.contentBriefs)
      .where(eq(s.contentBriefs.postId, post.id))
  )[0];
  const assessment = (
    await db
      .select()
      .from(s.draftAssessments)
      .where(eq(s.draftAssessments.briefId, brief.id))
  )[0];
  expect(assessment.revised).toBe(true);
  expect(assessment.critique.summary).toBe('Strengthen the comparison hook.');
});
it('detects recent-post repetition with bounded comparison', () => {
  const text =
    'Different participant motivations need different product success measures across prediction markets and sportsbooks.';
  expect(repetitionScore(text, text)).toBe(1);
  expect(
    repetitionScore(
      text,
      'Orchid roots require airy substrate with regular drainage.',
    ),
  ).toBe(0);
});
it('requires adequate same-platform cohorts before describing performance', () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    id: String(i),
    platform: 'x',
    body: i < 5 ? 'I learned to test the workflow.' : 'A product announcement.',
    impressions: 1000,
    likes: i < 5 ? 20 : 5,
    comments: 0,
    shares: 0,
  }));
  expect(performancePatterns(rows.slice(0, 9))).toEqual([]);
  expect(performancePatterns(rows)).toHaveLength(1);
  expect(performancePatterns(rows)[0].text).toContain('2.00%');
  expect(
    performancePatterns(
      rows.map((r, i) => ({ ...r, platform: i < 5 ? 'x' : 'linkedin' })),
    ),
  ).toEqual([]);
});
it('rejects a revised draft if its final audit still finds unsupported claims', async () => {
  const provider: AIProvider = {
    name: 'persistent-claim-error',
    generate: mock.generate.bind(mock),
    complete: async (r) => {
      const result = await mock.complete(r);
      if (JSON.parse(r.messages.at(-1)!.content!).task === 'draft-critique')
        result.text = JSON.stringify({
          ...JSON.parse(result.text),
          materialWeakness: true,
          unsupportedClaims: ['Invented customer result.'],
        });
      return result;
    },
  };
  await expect(strategicDraft(db, provider, 'x', note)).rejects.toThrow(
    'still contains unsupported claims',
  );
});
it('does not accept an invented quote or AI brief as factual support', async () => {
  const prepared = await prepareBrief(db, mock, note);
  const provider: AIProvider = {
    name: 'claim-audit',
    generate: mock.generate.bind(mock),
    complete: async (r) => {
      const result = await mock.complete(r);
      result.text = JSON.stringify({
        ...JSON.parse(result.text),
        claimChecks: [
          {
            claim: 'All prediction market users want long-term insight.',
            sourceId: 'source',
            quote: 'Everyone wants long-term insight.',
            verdict: 'supported',
          },
        ],
      });
      return result;
    },
  };
  const assessment = await critiqueDraft(
    db,
    provider,
    prepared,
    'x',
    note,
    'All prediction market users want long-term insight.',
  );
  expect(assessment.materialWeakness).toBe(true);
  expect(assessment.unsupportedClaims).toContain(
    'All prediction market users want long-term insight.',
  );
});
it('regeneration uses original source and prior angle rather than treating the draft as evidence', async () => {
  const post = await savePost(db, DEV_USER_ID, {
    title: 'Angle fixture',
    coreIdea: note,
  });
  await prepareBrief(db, mock, note, post.id);
  const { calls, provider } = recording();
  await prepareBrief(db, provider, note, post.id, 'Try Different Angle');
  const input = JSON.parse(
    calls
      .find(
        (r) => JSON.parse(r.messages.at(-1)!.content!).task === 'content-brief',
      )!
      .messages.at(-1)!.content!,
  );
  expect(input.source).toBe(note);
  expect(input.action).toBe('Try Different Angle');
  expect(
    input.context.records.some(
      (r: { type: string }) => r.type === 'previousAngle',
    ),
  ).toBe(true);
});
it('bounds a repair request even with long notes, profiles and a prior failed output', async () => {
  const prepared = await prepareBrief(db, mock, note);
  prepared.context.records.push(
    ...Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      type: 'knowledge',
      text: 'Detailed contextual source material. '.repeat(100),
    })),
  );
  let attempts = 0;
  const provider: AIProvider = {
    name: 'budget-repair',
    generate: mock.generate.bind(mock),
    complete: async (r) => {
      expect(requestBudget(r).tokens).toBeLessThanOrEqual(6000);
      attempts++;
      return attempts === 1
        ? {
            text: JSON.stringify({
              platform: 'linkedin',
              body: 'x'.repeat(3100),
              hashtags: ['Product', 'Strategy', 'Research'],
            }),
            model: 'fixture',
            inputTokens: 0,
            outputTokens: 0,
          }
        : mock.complete(r);
    },
  };
  const draft = await draftPlatform(
    db,
    provider,
    'linkedin',
    note.repeat(30),
    'Generate Draft',
    'Additional request. '.repeat(200),
    prepared,
  );
  expect(attempts).toBe(2);
  expect(validatePlatform('linkedin', draft.body).valid).toBe(true);
});
