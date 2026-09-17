import twitter from 'twitter-text';
export type DraftPlatform = 'x' | 'linkedin';
export function validatePlatform(platform: string, text: string) {
  const parsed = platform === 'x' ? twitter.parseTweet(text) : null;
  const count = parsed?.weightedLength ?? text.length;
  const limit = platform === 'x' ? 280 : platform === 'linkedin' ? 3000 : 30000;
  const valid = !!text.trim() && count <= limit && (parsed?.valid ?? true);
  return {
    valid,
    count,
    limit,
    error: valid
      ? null
      : `${platform === 'x' ? 'X' : 'LinkedIn'} requires nonempty valid text within ${limit} ${platform === 'x' ? 'weighted ' : ''}characters (currently ${count}), including hashtags.`,
  };
}
export function assertPlatform(platform: string, text: string) {
  const result = validatePlatform(platform, text);
  if (!result.valid) throw new Error(result.error!);
  return result;
}
export const hashtagsIn = (text: string) => twitter.extractHashtags(text);
export function withoutHashtags(text: string) {
  let result = text;
  for (const tag of [...twitter.extractHashtagsWithIndices(text)].reverse())
    result = result.slice(0, tag.indices[0]) + result.slice(tag.indices[1]);
  return result.trim();
}
export const composePost = (body: string, hashtags: string[]) =>
  [body.trim(), hashtags.map((tag) => '#' + tag.replace(/^#/, '')).join(' ')]
    .filter(Boolean)
    .join('\n\n');
