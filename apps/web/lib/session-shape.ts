import type { Session } from 'next-auth';

export const toBrowserSession = <
  T extends {
    expires: string;
    user?: {
      email?: string | null;
      image?: string | null;
      name?: string | null;
    } | null;
  },
>(
  session: T,
): Session => ({
  expires: session.expires,
  user: session.user
    ? {
        email: session.user.email ?? null,
        image: session.user.image ?? null,
        name: session.user.name ?? null,
      }
    : undefined,
});
