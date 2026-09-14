import 'server-only';
import { isLocalMode } from '../lib/config';
import { MockAuthenticationProvider } from '../providers/mocks';
import type { AuthenticationProvider } from '../providers/contracts';
class AuthJsAuthenticationProvider implements AuthenticationProvider {
  async currentUser() {
    const { auth } = await import('../auth');
    const session = await auth();
    if (
      !process.env.OWNER_EMAIL ||
      session?.user?.email?.toLowerCase() !==
        process.env.OWNER_EMAIL.toLowerCase()
    )
      return null;
    const { getDb } = await import('../db/client');
    const { users } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');
    const db = await getDb();
    const [owner] = await db
      .select()
      .from(users)
      .where(eq(users.email, session.user.email));
    return owner || null;
  }
}
export async function requireUser() {
  const provider: AuthenticationProvider = isLocalMode()
    ? new MockAuthenticationProvider()
    : new AuthJsAuthenticationProvider();
  const user = await provider.currentUser();
  if (!user)
    throw new Error('Private workspace: owner authentication required.');
  return user;
}
