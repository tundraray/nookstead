import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Discord from 'next-auth/providers/discord';

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
