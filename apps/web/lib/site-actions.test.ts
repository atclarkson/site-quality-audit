import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseDatabaseEnv } from '@site-quality-audit/config';
import {
  MembershipRole,
  createPrismaClient,
} from '@site-quality-audit/database';
import type { AuthorizedAppContext } from './authorized-app-context';

const redirectSignal = Symbol('redirect');

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw { path, redirectSignal };
  }),
}));

vi.mock('./authorized-app-context', () => ({
  getAuthorizedAppContext: vi.fn(),
}));

vi.mock('./site-management', async () => {
  const actual =
    await vi.importActual<typeof import('./site-management')>(
      './site-management',
    );

  return {
    ...actual,
    createSiteForWorkspace: vi.fn(actual.createSiteForWorkspace),
    deleteSiteForWorkspace: vi.fn(actual.deleteSiteForWorkspace),
    updateSiteForWorkspace: vi.fn(actual.updateSiteForWorkspace),
  };
});

vi.mock('./audit-management', async () => {
  const actual =
    await vi.importActual<typeof import('./audit-management')>(
      './audit-management',
    );

  return {
    ...actual,
    startAuditForSite: vi.fn(actual.startAuditForSite),
  };
});

import { getAuthorizedAppContext } from './authorized-app-context';
import { startAuditForSite } from './audit-management';
import {
  createSiteAction,
  deleteSiteAction,
  startAuditAction,
  updateSiteAction,
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

beforeEach(async () => {
  vi.clearAllMocks();

  const siteManagementActual =
    await vi.importActual<typeof import('./site-management')>(
      './site-management',
    );
  const auditManagementActual =
    await vi.importActual<typeof import('./audit-management')>(
      './audit-management',
    );

  vi.mocked(createSiteForWorkspace).mockImplementation(
    siteManagementActual.createSiteForWorkspace,
  );
  vi.mocked(deleteSiteForWorkspace).mockImplementation(
    siteManagementActual.deleteSiteForWorkspace,
  );
  vi.mocked(updateSiteForWorkspace).mockImplementation(
    siteManagementActual.updateSiteForWorkspace,
  );
  vi.mocked(startAuditForSite).mockImplementation(
    auditManagementActual.startAuditForSite,
  );
});

afterAll(async () => {
  await db.$disconnect();
});

describe('site server actions', () => {
  it('re-authenticates create at execution time instead of using stale render state', async () => {
    const firstContext = await createAuthorizedContext('stale-first');
    const secondContext = await createAuthorizedContext('stale-second');
    let activeContext: AuthorizedAppContext | null = firstContext;

    vi.mocked(getAuthorizedAppContext).mockImplementation(
      async () => activeContext,
    );
    vi.mocked(createSiteForWorkspace).mockResolvedValue({
      id: 'site-1',
    } as never);

    try {
      activeContext = secondContext;

      await expect(
        createSiteAction(
          createEmptySiteFormState(),
          formDataFromValues({
            name: 'Fresh Context Site',
            primaryUrl: 'https://example.com',
            sitemapUrl: '',
          }),
        ),
      ).rejects.toMatchObject({ path: '/app/sites/site-1' });

      expect(createSiteForWorkspace).toHaveBeenCalledWith(secondContext, {
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

  it('fails closed when unauthenticated for create, update, delete, and start-audit', async () => {
    vi.mocked(getAuthorizedAppContext).mockResolvedValue(null);

    await expect(
      createSiteAction(
        createEmptySiteFormState(),
        formDataFromValues({
          name: 'No Session Site',
          primaryUrl: 'https://example.com',
          sitemapUrl: '',
        }),
      ),
    ).rejects.toMatchObject({ path: '/' });
    await expect(
      updateSiteAction(
        'site-1',
        createEmptySiteFormState(),
        formDataFromValues({
          name: 'No Session Site',
          primaryUrl: 'https://example.com',
          sitemapUrl: '',
        }),
      ),
    ).rejects.toMatchObject({ path: '/' });
    await expect(deleteSiteAction('site-1')).rejects.toMatchObject({
      path: '/',
    });
    await expect(startAuditAction('site-1')).rejects.toMatchObject({
      path: '/',
    });

    expect(createSiteForWorkspace).not.toHaveBeenCalled();
    expect(updateSiteForWorkspace).not.toHaveBeenCalled();
    expect(deleteSiteForWorkspace).not.toHaveBeenCalled();
    expect(startAuditForSite).not.toHaveBeenCalled();
  });

  it('keeps a bound siteId tenant-scoped for update', async () => {
    const ownerContext = await createAuthorizedContext('action-owner-update');
    const otherContext = await createAuthorizedContext('action-other-update');

    vi.mocked(getAuthorizedAppContext).mockResolvedValue(otherContext);

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

      await expect(
        updateSiteAction(
          site.id,
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

  it('blocks cross-workspace delete and start-audit mutations', async () => {
    const ownerContext = await createAuthorizedContext('action-owner-mutate');
    const otherContext = await createAuthorizedContext('action-other-mutate');

    vi.mocked(getAuthorizedAppContext).mockResolvedValue(otherContext);

    try {
      const site = await createSiteForWorkspace(
        ownerContext,
        {
          name: 'Protected Site',
          primaryUrl: 'https://protected-mutate.example.com',
          sitemapUrl: '',
        },
        db,
      );

      await expect(deleteSiteAction(site.id)).rejects.toMatchObject({
        path: '/app',
      });
      expect(
        await getSiteForWorkspace(ownerContext, site.id, db),
      ).not.toBeNull();

      await expect(startAuditAction(site.id)).rejects.toMatchObject({
        path: '/app',
      });
      expect(startAuditForSite).toHaveBeenCalledWith(otherContext, site.id);
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

  it('re-authenticates start-audit at execution time', async () => {
    const firstContext = await createAuthorizedContext('audit-stale-first');
    const secondContext = await createAuthorizedContext('audit-stale-second');
    let activeContext: AuthorizedAppContext | null = firstContext;

    vi.mocked(getAuthorizedAppContext).mockImplementation(
      async () => activeContext,
    );
    vi.mocked(startAuditForSite).mockResolvedValue({ id: 'audit-1' } as never);

    try {
      activeContext = secondContext;

      await expect(startAuditAction('site-1')).rejects.toMatchObject({
        path: '/app/sites/site-1/audits/audit-1',
      });
      expect(startAuditForSite).toHaveBeenCalledWith(secondContext, 'site-1');
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
