import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Discord from 'next-auth/providers/discord';
import { getDb, findOrCreateUser, users, eq } from '@nookstead/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google, Discord],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) {
        return false;
      }

      if (!account) {
        return false;
      }

      try {
        const db = getDb();
        await findOrCreateUser(db, {
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        });
        return true;
      } catch (error) {
        console.error('Failed to persist user on sign-in:', error);
        return false;
      }
    },

    async jwt({ token }) {
      if (token.email && !token.userId) {
        try {
          const db = getDb();
          const [dbUser] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, token.email))
            .limit(1);

          if (dbUser) {
            token.userId = dbUser.id;
          }
        } catch (error) {
          console.error('Failed to fetch user in jwt callback:', error);
        }
      }
      return token;
    },

    session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },

    authorized({ auth: session, request }) {
      const isGameRoute = request.nextUrl.pathname.startsWith('/game');
      const isLoggedIn = !!session?.user;

      if (isGameRoute && !isLoggedIn) {
        return false; // redirects to signIn page (/)
      }

      return true;
    },
  },
});
