import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { parseDatabaseEnv } from '@site-quality-audit/config';
import {
  MembershipRole,
  createPrismaClient,
} from '@site-quality-audit/database';
import type { AuthorizedAppContext } from './authorized-app-context';
vi.mock('./authorized-app-context', () => ({
  getAuthorizedAppContext: vi.fn(),
}));
import {
  createCreateSiteAction,
  createDeleteSiteAction,
  createStartAuditAction,
  createUpdateSiteAction,
} from './site-actions';
import {
  createSiteForWorkspace,
  createEmptySiteFormState,
  deleteSiteForWorkspace,
  getSiteForWorkspace,
  updateSiteForWorkspace,
} from './site-management';

const { DATABASE_URL } = parseDatabaseEnv({
  ...process.env,
  AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID || 'test-google-id',
  AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET || 'test-google-secret',
  AUTH_SECRET: process.env.AUTH_SECRET || 'test-auth-secret',
});
const db = createPrismaClient({ datasourceUrl: DATABASE_URL });

const unique = (prefix: string) => `${prefix}-${randomUUID()}`;

const createAuthorizedContext = async (
  emailPrefix: string,
): Promise<AuthorizedAppContext> => {
  const user = await db.user.create({
    data: {
      email: `${unique(emailPrefix)}@example.com`,
      name: `${emailPrefix} User`,
    },
  });

  const workspace = await db.workspace.create({
    data: {
      name: `${emailPrefix} Workspace`,
      ownerUserId: user.id,
      slug: unique(`${emailPrefix}-workspace`),
    },
  });

  await db.membership.create({
    data: {
      userId: user.id,
      workspaceId: workspace.id,
      role: MembershipRole.OWNER,
    },
  });

  return {
    role: MembershipRole.OWNER,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
    },
  };
};

const formDataFromValues = (values: Record<string, string>) => {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return formData;
};

const redirectSignal = Symbol('redirect');

const createRedirectStub = () =>
  vi.fn((path: string) => {
    throw { path, redirectSignal };
  });

afterAll(async () => {
  await db.$disconnect();
});

describe('site server actions', () => {
  it('rejects a mutation when no authenticated session exists at execution time', async () => {
    const redirectImpl = createRedirectStub();
    const createSiteForWorkspaceImpl = vi.fn();
    const action = createCreateSiteAction({
      createSiteForWorkspaceImpl,
      getAuthorizedAppContextImpl: vi.fn().mockResolvedValue(null),
      redirectImpl,
    });

    await expect(
      action(
        createEmptySiteFormState(),
        formDataFromValues({
          name: 'No Session Site',
          primaryUrl: 'https://example.com',
          sitemapUrl: '',
        }),
      ),
    ).rejects.toMatchObject({ path: '/' });

    expect(createSiteForWorkspaceImpl).not.toHaveBeenCalled();
  });

  it('uses the fresh authenticated session instead of stale render-time context', async () => {
    const firstContext = await createAuthorizedContext('stale-first');
    const secondContext = await createAuthorizedContext('stale-second');
    let activeContext: AuthorizedAppContext | null = firstContext;
    const createSiteForWorkspaceImpl = vi
      .fn()
      .mockResolvedValue({ id: 'site-1' });
    const redirectImpl = createRedirectStub();
    const action = createCreateSiteAction({
      createSiteForWorkspaceImpl,
      getAuthorizedAppContextImpl: vi.fn(async () => activeContext),
      redirectImpl,
    });

    try {
      activeContext = secondContext;

      await expect(
        action(
          createEmptySiteFormState(),
          formDataFromValues({
            name: 'Fresh Context Site',
            primaryUrl: 'https://example.com',
            sitemapUrl: '',
          }),
        ),
      ).rejects.toMatchObject({ path: '/app/sites/site-1' });

      expect(createSiteForWorkspaceImpl).toHaveBeenCalledWith(secondContext, {
        name: 'Fresh Context Site',
        primaryUrl: 'https://example.com',
        sitemapUrl: '',
      });
    } finally {
      await db.workspace.deleteMany({
        where: {
          id: {
            in: [firstContext.workspace.id, secondContext.workspace.id],
          },
        },
      });
    }
  });

  it('update still cannot affect another workspace', async () => {
    const ownerContext = await createAuthorizedContext('action-owner-update');
    const otherContext = await createAuthorizedContext('action-other-update');
    const redirectImpl = createRedirectStub();

    try {
      const site = await createSiteForWorkspace(
        ownerContext,
        {
          name: 'Protected Site',
          primaryUrl: 'https://protected-update.example.com',
          sitemapUrl: '',
        },
        db,
      );

      const action = createUpdateSiteAction(site.id, {
        getAuthorizedAppContextImpl: vi.fn().mockResolvedValue(otherContext),
        redirectImpl,
        updateSiteForWorkspaceImpl: updateSiteForWorkspace,
      });

      await expect(
        action(
          createEmptySiteFormState(),
          formDataFromValues({
            name: 'Hijacked Name',
            primaryUrl: 'https://hijacked.example.com',
            sitemapUrl: '',
          }),
        ),
      ).rejects.toMatchObject({ path: '/app' });

      const persistedSite = await getSiteForWorkspace(
        ownerContext,
        site.id,
        db,
      );
      expect(persistedSite?.name).toBe('Protected Site');
      expect(persistedSite?.primaryUrl).toBe(
        'https://protected-update.example.com',
      );
    } finally {
      await db.workspace.deleteMany({
        where: {
          id: {
            in: [ownerContext.workspace.id, otherContext.workspace.id],
          },
        },
      });
    }
  });

  it('delete still cannot affect another workspace', async () => {
    const ownerContext = await createAuthorizedContext('action-owner-delete');
    const otherContext = await createAuthorizedContext('action-other-delete');
    const redirectImpl = createRedirectStub();

    try {
      const site = await createSiteForWorkspace(
        ownerContext,
        {
          name: 'Protected Delete Site',
          primaryUrl: 'https://protected-delete.example.com',
          sitemapUrl: '',
        },
        db,
      );

      const action = createDeleteSiteAction(site.id, {
        deleteSiteForWorkspaceImpl: async (context, currentSiteId) =>
          deleteSiteForWorkspace(context, currentSiteId, db),
        getAuthorizedAppContextImpl: vi.fn().mockResolvedValue(otherContext),
        redirectImpl,
      });

      await expect(action()).rejects.toMatchObject({ path: '/app' });
      expect(
        await getSiteForWorkspace(ownerContext, site.id, db),
      ).not.toBeNull();
    } finally {
      await db.workspace.deleteMany({
        where: {
          id: {
            in: [ownerContext.workspace.id, otherContext.workspace.id],
          },
        },
      });
    }
  });

  it('start audit rejects execution without an authenticated session', async () => {
    const redirectImpl = createRedirectStub();
    const startAuditForSiteImpl = vi.fn();
    const action = createStartAuditAction('site-1', {
      getAuthorizedAppContextImpl: vi.fn().mockResolvedValue(null),
      redirectImpl,
      startAuditForSiteImpl,
    });

    await expect(action()).rejects.toMatchObject({ path: '/' });
    expect(startAuditForSiteImpl).not.toHaveBeenCalled();
  });

  it('start audit uses the fresh authenticated session at execution time', async () => {
    const firstContext = await createAuthorizedContext('audit-stale-first');
    const secondContext = await createAuthorizedContext('audit-stale-second');
    let activeContext: AuthorizedAppContext | null = firstContext;
    const redirectImpl = createRedirectStub();
    const startAuditForSiteImpl = vi.fn().mockResolvedValue({ id: 'audit-1' });
    const action = createStartAuditAction('site-1', {
      getAuthorizedAppContextImpl: vi.fn(async () => activeContext),
      redirectImpl,
      startAuditForSiteImpl,
    });

    try {
      activeContext = secondContext;

      await expect(action()).rejects.toMatchObject({
        path: '/app/sites/site-1',
      });
      expect(startAuditForSiteImpl).toHaveBeenCalledWith(
        secondContext,
        'site-1',
      );
    } finally {
      await db.workspace.deleteMany({
        where: {
          id: {
            in: [firstContext.workspace.id, secondContext.workspace.id],
          },
        },
      });
    }
  });
});
