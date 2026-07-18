import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { parseDatabaseEnv } from '@site-quality-audit/config';
import { MembershipRole, createPrismaClient } from './index';

const { DATABASE_URL } = parseDatabaseEnv(process.env);
const db = createPrismaClient({ datasourceUrl: DATABASE_URL });

const unique = (prefix: string) => `${prefix}-${randomUUID()}`;

const createUser = async () =>
  db.user.create({
    data: {
      email: `${unique('user')}@example.com`,
    },
  });

const createWorkspace = async () =>
  db.workspace.create({
    data: {
      name: unique('workspace'),
      slug: unique('workspace'),
    },
  });

const createMembership = async (
  userId: string,
  workspaceId: string,
  role: MembershipRole,
) =>
  db.membership.create({
    data: {
      userId,
      workspaceId,
      role,
    },
  });

const createSite = async (workspaceId: string, normalizedPrimaryUrl: string) =>
  db.site.create({
    data: {
      workspaceId,
      name: unique('site'),
      primaryUrl: normalizedPrimaryUrl,
      normalizedPrimaryUrl,
    },
  });

afterAll(async () => {
  await db.$disconnect();
});

describe('database tenant constraints', () => {
  it('allows a user to belong to a workspace', async () => {
    const user = await createUser();
    const workspace = await createWorkspace();

    try {
      const membership = await createMembership(
        user.id,
        workspace.id,
        MembershipRole.OWNER,
      );

      expect(membership.userId).toBe(user.id);
      expect(membership.workspaceId).toBe(workspace.id);
      expect(membership.role).toBe(MembershipRole.OWNER);
    } finally {
      await db.workspace.delete({ where: { id: workspace.id } });
      await db.user.delete({ where: { id: user.id } });
    }
  });

  it('rejects duplicate memberships for the same user and workspace', async () => {
    const user = await createUser();
    const workspace = await createWorkspace();

    try {
      await createMembership(user.id, workspace.id, MembershipRole.EDITOR);

      await expect(
        createMembership(user.id, workspace.id, MembershipRole.VIEWER),
      ).rejects.toHaveProperty('code', 'P2002');
    } finally {
      await db.workspace.delete({ where: { id: workspace.id } });
      await db.user.delete({ where: { id: user.id } });
    }
  });

  it('allows two workspaces to register the same normalized site URL', async () => {
    const firstWorkspace = await createWorkspace();
    const secondWorkspace = await createWorkspace();
    const normalizedPrimaryUrl = 'https://example.com';

    try {
      const firstSite = await createSite(
        firstWorkspace.id,
        normalizedPrimaryUrl,
      );
      const secondSite = await createSite(
        secondWorkspace.id,
        normalizedPrimaryUrl,
      );

      expect(firstSite.normalizedPrimaryUrl).toBe(normalizedPrimaryUrl);
      expect(secondSite.normalizedPrimaryUrl).toBe(normalizedPrimaryUrl);
    } finally {
      await db.workspace.deleteMany({
        where: {
          id: {
            in: [firstWorkspace.id, secondWorkspace.id],
          },
        },
      });
    }
  });

  it('rejects duplicate normalized site URLs within one workspace', async () => {
    const workspace = await createWorkspace();
    const normalizedPrimaryUrl = 'https://example.com';

    try {
      await createSite(workspace.id, normalizedPrimaryUrl);

      await expect(
        createSite(workspace.id, normalizedPrimaryUrl),
      ).rejects.toHaveProperty('code', 'P2002');
    } finally {
      await db.workspace.delete({ where: { id: workspace.id } });
    }
  });

  it('deletes memberships and sites when a workspace is deleted', async () => {
    const user = await createUser();
    const workspace = await createWorkspace();
    const site = await createSite(workspace.id, 'https://cascade.example.com');
    const membership = await createMembership(
      user.id,
      workspace.id,
      MembershipRole.OWNER,
    );

    await db.workspace.delete({ where: { id: workspace.id } });

    try {
      expect(
        await db.membership.findUnique({ where: { id: membership.id } }),
      ).toBeNull();
      expect(await db.site.findUnique({ where: { id: site.id } })).toBeNull();
    } finally {
      await db.user.delete({ where: { id: user.id } });
    }
  });

  it('persists membership roles correctly', async () => {
    const user = await createUser();
    const workspace = await createWorkspace();

    try {
      const membership = await createMembership(
        user.id,
        workspace.id,
        MembershipRole.VIEWER,
      );

      const persistedMembership = await db.membership.findUniqueOrThrow({
        where: { id: membership.id },
      });

      expect(persistedMembership.role).toBe(MembershipRole.VIEWER);
    } finally {
      await db.workspace.delete({ where: { id: workspace.id } });
      await db.user.delete({ where: { id: user.id } });
    }
  });
});
