export function isLocalMode() {
  if (process.env.VERCEL && process.env.LOCAL_DEV_MODE === 'true')
    throw new Error('Local mode must never be deployed to Vercel.');
  return (
    process.env.LOCAL_DEV_MODE === 'true' ||
    (!process.env.VERCEL &&
      process.env.NODE_ENV !== 'production' &&
      process.env.LOCAL_DEV_MODE !== 'false')
  );
}
export const timezone = () => process.env.APP_TIMEZONE || 'America/New_York';
