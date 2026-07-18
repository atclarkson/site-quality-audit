import { MembershipRole } from '@site-quality-audit/database';
import { getPrismaClient } from '@site-quality-audit/database';
import { auth } from '../auth';

export type AuthorizedAppContext = {
  role: MembershipRole;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
};

export const getAuthorizedAppContext =
  async (): Promise<AuthorizedAppContext | null> => {
    const session = await auth();
    const email = session?.user?.email;

    if (!email) {
      return null;
    }

    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        ownedWorkspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!user?.ownedWorkspace) {
      return null;
    }

    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: user.ownedWorkspace.id,
        },
      },
      select: {
        role: true,
      },
    });

    if (!membership) {
      return null;
    }

    return {
      role: membership.role,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      workspace: {
        id: user.ownedWorkspace.id,
        name: user.ownedWorkspace.name,
        slug: user.ownedWorkspace.slug,
      },
    };
  };
