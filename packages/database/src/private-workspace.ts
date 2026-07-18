import { PrismaClient } from '@prisma/client';
import { MembershipRole } from '@prisma/client';

const fallbackWorkspaceName = 'My Workspace';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

const personalWorkspaceSlug = (userId: string, userName?: string | null) => {
  const base = slugify(userName?.trim() || fallbackWorkspaceName);
  const suffix = userId.replace(/-/g, '').slice(0, 12);
  return `${base || 'my-workspace'}-${suffix}`;
};

export const ensurePrivateWorkspaceForUser = async (
  prisma: PrismaClient,
  userId: string,
  userName?: string | null,
) => {
  try {
    return await prisma.$transaction(async (tx) => {
      let workspace = await tx.workspace.findUnique({
        where: {
          ownerUserId: userId,
        },
      });

      if (!workspace) {
        workspace = await tx.workspace.create({
          data: {
            name: userName?.trim() || fallbackWorkspaceName,
            ownerUserId: userId,
            slug: personalWorkspaceSlug(userId, userName),
          },
        });
      }

      await tx.membership.upsert({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId: workspace.id,
          },
        },
        update: {
          role: MembershipRole.OWNER,
        },
        create: {
          userId,
          workspaceId: workspace.id,
          role: MembershipRole.OWNER,
        },
      });

      return workspace;
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return prisma.$transaction(async (tx) => {
        const workspace = await tx.workspace.findUniqueOrThrow({
          where: { ownerUserId: userId },
        });

        await tx.membership.upsert({
          where: {
            userId_workspaceId: {
              userId,
              workspaceId: workspace.id,
            },
          },
          update: {
            role: MembershipRole.OWNER,
          },
          create: {
            userId,
            workspaceId: workspace.id,
            role: MembershipRole.OWNER,
          },
        });

        return workspace;
      });
    }

    throw error;
  }
};
