import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { parseDatabaseEnv } from '@site-quality-audit/config';
import {
  MembershipRole,
  createPrismaClient,
} from '@site-quality-audit/database';
import { createAuthLogger, createAuthOptions } from './auth-options';

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

describe('createAuthOptions', () => {
  it('does not reject a valid sign-in from the authorization callback', async () => {
    const callbacks = createAuthOptions(db).callbacks!;
    const signInArgs = {
      user: {
        email: 'user@example.com',
        id: 'missing-is-fine-here',
        name: 'User Example',
      },
    } as Parameters<NonNullable<typeof callbacks.signIn>>[0];

    await expect(callbacks?.signIn?.(signInArgs)).resolves.toBe(true);
  });

  it('provisions a private workspace when Auth.js creates a user', async () => {
    const { events } = createAuthOptions(db);
    const user = await createUser('Create Event User');

    try {
      await events?.createUser?.({ user });

      const workspace = await db.workspace.findUniqueOrThrow({
        where: { ownerUserId: user.id },
      });
      const membership = await db.membership.findUniqueOrThrow({
        where: {
          userId_workspaceId: {
            userId: user.id,
            workspaceId: workspace.id,
          },
        },
      });

      expect(workspace.name).toBe('Create Event User');
      expect(membership.role).toBe(MembershipRole.OWNER);
    } finally {
      await db.user.delete({ where: { id: user.id } });
    }
  });

  it('reuses the same private workspace on repeated returning sign-in events', async () => {
    const { events } = createAuthOptions(db);
    const user = await createUser('Returning User');

    try {
      await events?.signIn?.({ user });
      await events?.signIn?.({ user });

      const workspace = await db.workspace.findUniqueOrThrow({
        where: { ownerUserId: user.id },
      });

      expect(
        await db.workspace.count({ where: { ownerUserId: user.id } }),
      ).toBe(1);
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

  it('repairs a missing private workspace on returning sign-in', async () => {
    const { events } = createAuthOptions(db);
    const user = await createUser('Repair User');

    try {
      await events?.signIn?.({ user });

      const workspace = await db.workspace.findUniqueOrThrow({
        where: { ownerUserId: user.id },
      });

      await db.membership.delete({
        where: {
          userId_workspaceId: {
            userId: user.id,
            workspaceId: workspace.id,
          },
        },
      });
      await db.workspace.delete({ where: { id: workspace.id } });

      await events?.signIn?.({ user });

      const repairedWorkspace = await db.workspace.findUniqueOrThrow({
        where: { ownerUserId: user.id },
      });
      const repairedMembership = await db.membership.findUniqueOrThrow({
        where: {
          userId_workspaceId: {
            userId: user.id,
            workspaceId: repairedWorkspace.id,
          },
        },
      });

      expect(repairedMembership.role).toBe(MembershipRole.OWNER);
    } finally {
      await db.user.delete({ where: { id: user.id } });
    }
  });
});

describe('createAuthLogger', () => {
  it('redacts OAuth and session tokens from server-side auth logs', () => {
    const sink = vi.fn();
    const logger = createAuthLogger(sink);

    logger.debug?.('OAuthCallbackError', {
      access_token: 'access-token',
      account: {
        provider: 'google',
        refresh_token: 'refresh-token',
      },
      profile: {
        email: 'user@example.com',
      },
      sessionToken: 'session-token',
    });

    const [record] = sink.mock.calls[0];

    expect(record).toContain('"category":"oauth"');
    expect(record).toContain('[redacted]');
    expect(record).not.toContain('access-token');
    expect(record).not.toContain('refresh-token');
    expect(record).not.toContain('session-token');
    expect(record).not.toContain('user@example.com');
  });
});
