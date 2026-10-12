// Deterministic offline contracts. These are fixtures, not a claim of model quality.
export function mockBrainTask(
  task: Record<string, unknown>,
): object | undefined {
  const source = String(task.source || '');
  const comparison = /sportsbook/i.test(source) && /prediction/i.test(source);
  const insight = comparison
    ? 'Different participant motivations may require different product success measures across prediction markets and sportsbooks.'
    : /lesson|learn|mistake|spent|founder/i.test(source)
      ? 'A founder lesson becomes useful when it changes the next decision, not just the story told afterward.'
      : 'Acquisition and durable user value are different questions; define the behavior that would demonstrate value.';
  if (task.task === 'knowledge-ingestion')
    return {
      items: [
        {
          kind: 'observation',
          statement: source.slice(0, 220),
          confidence: 'user_claim',
          evidence: source.slice(0, 220),
          entities: comparison ? ['prediction markets', 'sportsbooks'] : [],
          themes: ['Product strategy'],
        },
        {
          kind: 'insight',
          statement: insight,
          confidence: 'inference',
          evidence: source.slice(0, 160),
          entities: [],
          themes: ['Operator lessons'],
        },
      ],
    };
  if (task.task === 'content-brief')
    return {
      sourceInsight: insight,
      whyItMatters:
        'A borrowed success metric can reward behavior the product does not need.',
      audience: 'Product operators and founders',
      objective:
        'Help the reader question whether their success measure matches user intent.',
      angles: [
        {
          angle: 'A shared category can conceal different user jobs',
          fit: 'Specific industry comparison grounded in the note.',
        },
        {
          angle: 'Choose the behavior before the metric',
          fit: 'Useful tactical implication without inventing results.',
        },
      ],
      strongestAngle: comparison
        ? 'A shared category can conceal different user jobs'
        : 'Choose the behavior before the metric',
      novelty:
        'Separates a familiar category label from the actual job the user wants done.',
      connectionToUser: 'Only the experience explicitly supplied in the note.',
      companyConnection:
        'Use only approved company facts if they strengthen the implication; no forced promotion.',
      timeliness: 'No verified current event required.',
      avoid: [
        'Repeating the opening of the raw note',
        'Claiming the inference is proven',
      ],
      platformExecution: {
        x: 'Lead directly with the mismatch between categories and user intent.',
        linkedin:
          'Explain the implication, then offer a concrete question for an operator to test.',
      },
    };
  if (task.task === 'draft-critique')
    return {
      scores: {
        hook: 4,
        clarity: 4,
        specificity: 4,
        novelty: 3,
        usefulness: 4,
        authenticity: 4,
        platformFit: 4,
        socialStrategyAlignment: 3,
        nonRepetition: 4,
        overallInterest: 4,
      },
      materialWeakness: false,
      issues: [],
      summary:
        'Offline contract check: bounded insight, qualified claims, separate platform execution. Human review remains necessary.',
      unsupportedClaims: [],
      claimChecks: [],
    };
}
