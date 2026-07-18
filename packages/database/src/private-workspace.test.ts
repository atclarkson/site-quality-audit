import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { parseDatabaseEnv } from '@site-quality-audit/config';
import { MembershipRole, createPrismaClient } from './index';
import { ensurePrivateWorkspaceForUser } from './private-workspace';

const { DATABASE_URL } = parseDatabaseEnv({
  ...process.env,
  AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID || 'test-google-id',
  AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET || 'test-google-secret',
  AUTH_SECRET: process.env.AUTH_SECRET || 'test-auth-secret',
});
const db = createPrismaClient({ datasourceUrl: DATABASE_URL });

const unique = (prefix: string) => `${prefix}-${randomUUID()}`;

const createUser = async (name?: string) =>
  db.user.create({
    data: {
      email: `${unique('user')}@example.com`,
      name,
    },
  });

afterAll(async () => {
  await db.$disconnect();
});

describe('ensurePrivateWorkspaceForUser', () => {
  it('creates one private workspace and one owner membership for a first login', async () => {
    const user = await createUser('Alice Example');

    try {
      const workspace = await ensurePrivateWorkspaceForUser(
        db,
        user.id,
        user.name,
      );
      const membership = await db.membership.findUniqueOrThrow({
        where: {
          userId_workspaceId: {
            userId: user.id,
            workspaceId: workspace.id,
          },
        },
      });

      expect(workspace.ownerUserId).toBe(user.id);
      expect(workspace.name).toBe('Alice Example');
      expect(membership.role).toBe(MembershipRole.OWNER);
    } finally {
      await db.user.delete({ where: { id: user.id } });
    }
  });

  it('reuses the same workspace on repeated provisioning', async () => {
    const user = await createUser('Repeat User');

    try {
      const first = await ensurePrivateWorkspaceForUser(db, user.id, user.name);
      const second = await ensurePrivateWorkspaceForUser(
        db,
        user.id,
        user.name,
      );

      expect(first.id).toBe(second.id);
      expect(
        await db.workspace.count({ where: { ownerUserId: user.id } }),
      ).toBe(1);
      expect(await db.membership.count({ where: { userId: user.id } })).toBe(1);
    } finally {
      await db.user.delete({ where: { id: user.id } });
    }
  });

  it('does not create duplicate private workspaces under concurrent provisioning', async () => {
    const user = await createUser('Concurrent User');

    try {
      const workspaces = await Promise.all(
        Array.from({ length: 6 }, () =>
          ensurePrivateWorkspaceForUser(db, user.id, user.name),
        ),
      );

      expect(new Set(workspaces.map((workspace) => workspace.id)).size).toBe(1);
      expect(
        await db.workspace.count({ where: { ownerUserId: user.id } }),
      ).toBe(1);
      expect(await db.membership.count({ where: { userId: user.id } })).toBe(1);
    } finally {
      await db.user.delete({ where: { id: user.id } });
    }
  });

  it('preserves an existing owner membership', async () => {
    const user = await createUser('Existing Owner');
    const workspace = await db.workspace.create({
      data: {
        name: 'Existing Owner',
        ownerUserId: user.id,
        slug: unique('existing-owner'),
      },
    });

    await db.membership.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        role: MembershipRole.OWNER,
      },
    });

    try {
      const ensured = await ensurePrivateWorkspaceForUser(
        db,
        user.id,
        user.name,
      );

      expect(ensured.id).toBe(workspace.id);
      expect(
        await db.membership.count({
          where: {
            userId: user.id,
            workspaceId: workspace.id,
            role: MembershipRole.OWNER,
          },
        }),
      ).toBe(1);
    } finally {
      await db.user.delete({ where: { id: user.id } });
    }
  });

  it('repairs a missing owner membership when a private workspace already exists', async () => {
    const user = await createUser('Repair User');
    const workspace = await db.workspace.create({
      data: {
        name: 'Repair User',
        ownerUserId: user.id,
        slug: unique('repair-user'),
      },
    });

    try {
      await ensurePrivateWorkspaceForUser(db, user.id, user.name);

      const membership = await db.membership.findUniqueOrThrow({
        where: {
          userId_workspaceId: {
            userId: user.id,
            workspaceId: workspace.id,
          },
        },
      });

      expect(membership.role).toBe(MembershipRole.OWNER);
    } finally {
      await db.user.delete({ where: { id: user.id } });
    }
  });
});
