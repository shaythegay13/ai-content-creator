import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    signIn({ profile }) {
      return Boolean(
        process.env.OWNER_EMAIL &&
        profile?.email_verified &&
        profile.email?.toLowerCase() === process.env.OWNER_EMAIL.toLowerCase(),
      );
    },
  },
});
