export const platforms = [
  'x',
  'linkedin',
  'instagram',
  'threads',
  'tiktok',
  'other',
] as const;
export const intelligenceCategories = [
  'prediction_market_news',
  'sportsbook_news',
  'operator_announcement',
  'company_article',
  'legislation',
  'regulation',
  'government',
  'academic_research',
  'industry_research',
  'industry_analysis',
  'technology',
  'other',
] as const;
export const ideaSources = [
  'manual',
  'ai',
  'notion',
  'trend',
  'conversation',
  'voice',
  'social',
  'other',
] as const;
export type Platform = (typeof platforms)[number] | (string & {});
export type IntelligenceRecord = {
  externalId: string;
  source: string;
  title: string;
  summary: string;
  category: string;
  importance: number;
  publishedAt: Date;
  sourceUrl?: string;
};
export type TrendRecord = {
  externalId: string;
  source: string;
  title: string;
  summary: string;
  score: number;
};
