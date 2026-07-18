import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { parseDatabaseEnv } from '@site-quality-audit/config';
import {
  MembershipRole,
  createPrismaClient,
} from '@site-quality-audit/database';
import type { AuthorizedAppContext } from './authorized-app-context';
import {
  SiteValidationError,
  createSiteForWorkspace,
  deleteSiteForWorkspace,
  getSiteForWorkspace,
  listSitesForWorkspace,
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

afterAll(async () => {
  await db.$disconnect();
});

describe('site management', () => {
  it('creates a site inside the authorized workspace', async () => {
    const context = await createAuthorizedContext('create-site');

    try {
      const site = await createSiteForWorkspace(
        context,
        {
          name: 'Example Site',
          primaryUrl: 'https://Example.com/?utm_source=test',
          sitemapUrl: 'https://example.com/sitemap.xml',
        },
        db,
      );

      expect(site.workspaceId).toBe(context.workspace.id);
      expect(site.primaryUrl).toBe('https://example.com');
      expect(site.normalizedPrimaryUrl).toBe('https://example.com');
      expect(site.sitemapUrl).toBe('https://example.com/sitemap.xml');
    } finally {
      await db.workspace.delete({ where: { id: context.workspace.id } });
    }
  });

  it('rejects duplicate normalized URLs safely within one workspace', async () => {
    const context = await createAuthorizedContext('duplicate-site');

    try {
      await createSiteForWorkspace(
        context,
        {
          name: 'First Site',
          primaryUrl: 'https://example.com',
          sitemapUrl: '',
        },
        db,
      );

      await expect(
        createSiteForWorkspace(
          context,
          {
            name: 'Second Site',
            primaryUrl: 'https://example.com/',
            sitemapUrl: '',
          },
          db,
        ),
      ).rejects.toMatchObject({
        fieldErrors: {
          primaryUrl: [
            'A site with this primary URL already exists in your workspace',
          ],
        },
      });
    } finally {
      await db.workspace.delete({ where: { id: context.workspace.id } });
    }
  });

  it('allows two workspaces to register the same normalized URL', async () => {
    const firstContext = await createAuthorizedContext('first-workspace');
    const secondContext = await createAuthorizedContext('second-workspace');

    try {
      const [firstSite, secondSite] = await Promise.all([
        createSiteForWorkspace(
          firstContext,
          {
            name: 'First',
            primaryUrl: 'https://example.com',
            sitemapUrl: '',
          },
          db,
        ),
        createSiteForWorkspace(
          secondContext,
          {
            name: 'Second',
            primaryUrl: 'https://example.com',
            sitemapUrl: '',
          },
          db,
        ),
      ]);

      expect(firstSite.workspaceId).toBe(firstContext.workspace.id);
      expect(secondSite.workspaceId).toBe(secondContext.workspace.id);
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

  it('does not let one user read another workspace site', async () => {
    const ownerContext = await createAuthorizedContext('owner-read');
    const otherContext = await createAuthorizedContext('other-read');

    try {
      const site = await createSiteForWorkspace(
        ownerContext,
        {
          name: 'Private Site',
          primaryUrl: 'https://private.example.com',
          sitemapUrl: '',
        },
        db,
      );

      await expect(
        getSiteForWorkspace(otherContext, site.id, db),
      ).resolves.toBe(null);
      await expect(listSitesForWorkspace(otherContext, db)).resolves.toEqual(
        [],
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

  it('does not let one user update another workspace site', async () => {
    const ownerContext = await createAuthorizedContext('owner-update');
    const otherContext = await createAuthorizedContext('other-update');

    try {
      const site = await createSiteForWorkspace(
        ownerContext,
        {
          name: 'Original Site',
          primaryUrl: 'https://owner-update.example.com',
          sitemapUrl: '',
        },
        db,
      );

      await expect(
        updateSiteForWorkspace(
          otherContext,
          site.id,
          {
            name: 'Hijacked Site',
            primaryUrl: 'https://hijacked.example.com',
            sitemapUrl: '',
          },
          db,
        ),
      ).resolves.toBeNull();

      const persistedSite = await getSiteForWorkspace(
        ownerContext,
        site.id,
        db,
      );
      expect(persistedSite?.name).toBe('Original Site');
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

  it('reruns normalization and uniqueness checks on edit', async () => {
    const context = await createAuthorizedContext('edit-site');

    try {
      const firstSite = await createSiteForWorkspace(
        context,
        {
          name: 'First Site',
          primaryUrl: 'https://example.com',
          sitemapUrl: '',
        },
        db,
      );
      const secondSite = await createSiteForWorkspace(
        context,
        {
          name: 'Second Site',
          primaryUrl: 'https://another.example.com/path',
          sitemapUrl: '',
        },
        db,
      );

      await expect(
        updateSiteForWorkspace(
          context,
          secondSite.id,
          {
            name: 'Second Site',
            primaryUrl: 'https://example.com/',
            sitemapUrl: '',
          },
          db,
        ),
      ).rejects.toBeInstanceOf(SiteValidationError);

      const updatedSite = await updateSiteForWorkspace(
        context,
        secondSite.id,
        {
          name: 'Updated Site',
          primaryUrl: 'https://Another.Example.com/path/',
          sitemapUrl: 'https://another.example.com/sitemap.xml?source=test',
        },
        db,
      );

      expect(firstSite.normalizedPrimaryUrl).toBe('https://example.com');
      expect(updatedSite).toMatchObject({
        name: 'Updated Site',
        primaryUrl: 'https://another.example.com/path',
        normalizedPrimaryUrl: 'https://another.example.com/path',
        sitemapUrl: 'https://another.example.com/sitemap.xml',
      });
    } finally {
      await db.workspace.delete({ where: { id: context.workspace.id } });
    }
  });

  it('deletes only the authorized site record', async () => {
    const ownerContext = await createAuthorizedContext('owner-delete');
    const otherContext = await createAuthorizedContext('other-delete');

    try {
      const ownerSite = await createSiteForWorkspace(
        ownerContext,
        {
          name: 'Owner Site',
          primaryUrl: 'https://owner-delete.example.com',
          sitemapUrl: '',
        },
        db,
      );
      const otherSite = await createSiteForWorkspace(
        otherContext,
        {
          name: 'Other Site',
          primaryUrl: 'https://other-delete.example.com',
          sitemapUrl: '',
        },
        db,
      );

      await expect(
        deleteSiteForWorkspace(ownerContext, otherSite.id, db),
      ).resolves.toBe(false);
      await expect(
        deleteSiteForWorkspace(ownerContext, ownerSite.id, db),
      ).resolves.toBe(true);

      expect(
        await getSiteForWorkspace(ownerContext, ownerSite.id, db),
      ).toBeNull();
      expect(
        await getSiteForWorkspace(otherContext, otherSite.id, db),
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
});
