// Isolated live acceptance fixtures. Does not populate the owner's profiles or content.
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import * as s from '../db/schema';
import { seed } from '../db/seed';
import { DEV_USER_ID } from '../providers/mocks';
import { GroqAIProvider } from '../providers/groq';
import { saveContentProfile } from '../services/content-profiles';
import { saveIdea, convertIdea } from '../services/content';
import { validatePlatform } from '../lib/platform-validation';
await mkdir('.local', { recursive: true });
const client = new PGlite();
const db = drizzle(client, { schema: s });
await migrate(db, { migrationsFolder: 'drizzle' });
await seed(db);
await saveContentProfile(db, {
  kind: 'user',
  fields: {
    role: 'Founder',
    expertise: 'Product decisions and customer discovery',
    publicPersonalContext:
      'Use only anecdotes explicitly supplied in the test notes.',
  },
});
await saveContentProfile(db, {
  kind: 'company',
  fields: {
    name: 'PlayMind',
    description: 'Company context is deliberately limited in this fixture.',
    priorities: 'Understand which customer problems deserve attention.',
    approvedClaims:
      'No revenue, customer, performance or product-capability claims have been provided.',
  },
});
await saveContentProfile(db, {
  kind: 'strategy',
  fields: {
    primaryGoals: 'Build credibility with thoughtful, useful observations',
    targetAudiences: 'Operators, investors and founders',
    desiredReputation: 'Specific and intellectually honest',
    promotionLevel: 'Low; do not force company references',
    ctaPhilosophy: 'A concrete useful question only when it adds value',
  },
});
const fixtures = [
  {
    title: 'Different users, different product questions',
    rawNote:
      'Talked to someone today. They said prediction markets care about different users than sportsbooks. Could be interesting for PlayMind.',
  },
  {
    title: 'A founder lesson about discovery',
    rawNote:
      'I spent an afternoon polishing a demo before a customer conversation. In the conversation, the useful moment was a rough sketch of their workflow, not the polished screens. My lesson: next time start with their workflow and earn the right to demo. One conversation, not proof this always works.',
  },
  {
    title: 'A PlayMind business question',
    rawNote:
      'For PlayMind, I want to understand the decision an operator needs to make before deciding which dashboard to build. More charts are not automatically more clarity. Working hypothesis: ask which action would change when a metric moves. We have not validated this yet; do not imply customer results.',
  },
];
const groq = new GroqAIProvider();
const provider = {
  name: groq.name,
  generate: groq.generate.bind(groq),
  complete: async (request: import('../providers/contracts').AIRequest) => {
    const task = JSON.parse(request.messages.at(-1)!.content || '{}').task;
    console.log('  ' + task + ' started');
    const response = await groq.complete(request);
    console.log(
      '  ' +
        task +
        ' complete: ' +
        response.inputTokens +
        ' + ' +
        response.outputTokens +
        ' tokens',
    );
    return response;
  },
};
const caseFilter = process.argv
  .find((arg) => arg.startsWith('--case='))
  ?.slice(7)
  .toLowerCase();
const previous =
  process.argv.includes('--retry-failures') || caseFilter
    ? (JSON.parse(await readFile('.local/content-brain-demo.json', 'utf8')) as {
        fixture: { title: string };
        variants: { generationStatus: string }[];
      }[])
    : [];
const results = [];
try {
  for (const fixture of fixtures) {
    const prior = previous.find((r) => r.fixture.title === fixture.title);
    if (
      prior &&
      caseFilter &&
      !caseFilter
        .split(',')
        .some((part) => fixture.title.toLowerCase().includes(part))
    ) {
      results.push(prior);
      continue;
    }
    if (
      !caseFilter &&
      prior?.variants.length === 2 &&
      prior.variants.every((v) => v.generationStatus === 'succeeded')
    ) {
      results.push(prior);
      continue;
    }
    console.log('Starting: ' + fixture.title);
    const idea = await saveIdea(db, DEV_USER_ID, fixture);
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
    const briefs = await db
      .select()
      .from(s.contentBriefs)
      .where(eq(s.contentBriefs.postId, post.id));
    const assessments = briefs.length
      ? await db
          .select()
          .from(s.draftAssessments)
          .where(eq(s.draftAssessments.briefId, briefs[0].id))
      : [];
    const knowledge = await db
      .select()
      .from(s.knowledgeItems)
      .where(eq(s.knowledgeItems.sourceKey, 'idea:' + idea.id));
    results.push({
      fixture,
      knowledge,
      briefs,
      variants: variants.map((v) => ({
        ...v,
        validation: validatePlatform(v.platform, v.body),
      })),
      assessments,
    });
    await writeFile(
      '.local/content-brain-demo.json',
      JSON.stringify(results, null, 2),
    );
    console.log(
      JSON.stringify({
        title: fixture.title,
        states: variants.map((v) => ({
          platform: v.platform,
          status: v.generationStatus,
          error: v.generationError,
          count: validatePlatform(v.platform, v.body).count,
        })),
      }),
    );
  }
  const usage = await db.select().from(s.aiUsage);
  await writeFile(
    '.local/content-brain-demo-usage.json',
    JSON.stringify(usage, null, 2),
  );
  if (
    results.some((r) =>
      r.variants.some((v) => v.generationStatus !== 'succeeded'),
    )
  )
    process.exitCode = 1;
} finally {
  await client.close();
}
