import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { parseDatabaseEnv } from '@site-quality-audit/config';
import {
  MembershipRole,
  createPrismaClient,
} from '@site-quality-audit/database';

vi.mock('../auth', () => ({
  auth: vi.fn(),
}));

import { auth } from '../auth';
import { getAuthorizedAppContext } from './authorized-app-context';
import { toBrowserSession } from './session-shape';

const { DATABASE_URL } = parseDatabaseEnv({
  ...process.env,
  AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID || 'test-google-id',
  AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET || 'test-google-secret',
  AUTH_SECRET: process.env.AUTH_SECRET || 'test-auth-secret',
});
const db = createPrismaClient({ datasourceUrl: DATABASE_URL });

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const unique = (prefix: string) => `${prefix}-${randomUUID()}`;

afterAll(async () => {
  await db.$disconnect();
});

describe('getAuthorizedAppContext', () => {
  it('rejects an unauthenticated request', async () => {
    mockedAuth.mockResolvedValueOnce(null);

    await expect(getAuthorizedAppContext()).resolves.toBeNull();
  });

  it('returns only the authenticated user private workspace', async () => {
    const user = await db.user.create({
      data: {
        email: `${unique('authorized')}@example.com`,
        name: 'Authorized User',
      },
    });

    const workspace = await db.workspace.create({
      data: {
        name: 'Authorized User',
        ownerUserId: user.id,
        slug: unique('authorized-user'),
      },
    });

    await db.membership.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        role: MembershipRole.OWNER,
      },
    });

    const otherUser = await db.user.create({
      data: {
        email: `${unique('other')}@example.com`,
      },
    });
    const otherWorkspace = await db.workspace.create({
      data: {
        name: 'Other Workspace',
        ownerUserId: otherUser.id,
        slug: unique('other-workspace'),
      },
    });
    await db.membership.create({
      data: {
        userId: otherUser.id,
        workspaceId: otherWorkspace.id,
        role: MembershipRole.OWNER,
      },
    });

    try {
      mockedAuth.mockResolvedValueOnce({
        expires: new Date(Date.now() + 60_000).toISOString(),
        user: {
          email: user.email,
          name: user.name,
        },
      });

      const context = await getAuthorizedAppContext();

      expect(context).toEqual({
        role: 'OWNER',
        user: {
          email: user.email,
          name: user.name,
        },
        workspace: {
          name: workspace.name,
          slug: workspace.slug,
        },
      });
    } finally {
      await db.user.deleteMany({
        where: {
          id: {
            in: [user.id, otherUser.id],
          },
        },
      });
    }
  });
});

describe('toBrowserSession', () => {
  it('does not include token fields in the browser-facing session shape', () => {
    const session = toBrowserSession({
      access_token: 'secret-token',
      expires: '2099-01-01T00:00:00.000Z',
      refresh_token: 'refresh-token',
      sessionToken: 'db-session-token',
      user: {
        email: 'user@example.com',
        image: 'https://example.com/image.png',
        name: 'User Example',
      },
    });

    expect(session).toEqual({
      expires: '2099-01-01T00:00:00.000Z',
      user: {
        email: 'user@example.com',
        image: 'https://example.com/image.png',
        name: 'User Example',
      },
    });
    expect(session).not.toHaveProperty('access_token');
    expect(session).not.toHaveProperty('refresh_token');
    expect(session).not.toHaveProperty('sessionToken');
  });
});
