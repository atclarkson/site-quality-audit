import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { getWebEnv } from '@site-quality-audit/config';
import { getPrismaClient } from '@site-quality-audit/database';
import { createAuthOptions } from './lib/auth-options';

const env = getWebEnv();
const prisma = getPrismaClient();

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  pages: {
    error: '/auth/error',
    signIn: '/',
  },
  providers: [
    Google({
      authorization: {
        params: {
          scope: 'openid email profile',
        },
      },
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
  ],
  secret: env.AUTH_SECRET,
  session: {
    strategy: 'database',
  },
  trustHost: env.AUTH_TRUST_HOST,
  ...createAuthOptions(prisma),
});
