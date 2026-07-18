import { z } from 'zod';
import {
  getPrismaClient,
  Prisma,
  type DatabaseClient,
} from '@site-quality-audit/database';
import { normalizeSiteUrl } from '@site-quality-audit/validation';
import type { AuthorizedAppContext } from './authorized-app-context';

const siteNameSchema = z.string().trim().min(1, 'Enter a site name').max(120);
const siteUrlSchema = z.string().trim().min(1, 'Enter a URL').max(2_048);
const optionalSiteUrlSchema = z.string().trim().max(2_048);

const siteInputSchema = z.object({
  name: siteNameSchema,
  primaryUrl: siteUrlSchema,
  sitemapUrl: optionalSiteUrlSchema,
});

export type SiteFormValues = {
  name: string;
  primaryUrl: string;
  sitemapUrl: string;
};

export type SiteFieldErrors = Partial<Record<keyof SiteFormValues, string[]>>;

export type SiteFormState = {
  fieldErrors?: SiteFieldErrors;
  formError?: string;
  values: SiteFormValues;
};

export type WorkspaceSite = Awaited<
  ReturnType<typeof listSitesForWorkspace>
>[number];

export class SiteValidationError extends Error {
  fieldErrors: SiteFieldErrors;

  constructor(fieldErrors: SiteFieldErrors, formError?: string) {
    super(formError || 'Site details could not be saved');
    this.fieldErrors = fieldErrors;
    this.name = 'SiteValidationError';
  }
}

const emptySiteValues: SiteFormValues = {
  name: '',
  primaryUrl: '',
  sitemapUrl: '',
};

const isSiteUniquenessError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002' &&
  Array.isArray(error.meta?.target) &&
  error.meta.target.includes('normalizedPrimaryUrl');

const buildSiteValidationError = (
  field: keyof SiteFormValues,
  message: string,
) => new SiteValidationError({ [field]: [message] });

const parseSiteInput = (values: SiteFormValues) => {
  const parsed = siteInputSchema.safeParse(values);

  if (!parsed.success) {
    throw new SiteValidationError(parsed.error.flatten().fieldErrors);
  }

  let primaryUrl: string;

  try {
    primaryUrl = normalizeSiteUrl(parsed.data.primaryUrl).canonicalUrl;
  } catch (error) {
    throw buildSiteValidationError(
      'primaryUrl',
      error instanceof Error ? error.message : 'Enter a valid URL',
    );
  }

  let sitemapUrl: string | null = null;

  if (parsed.data.sitemapUrl) {
    try {
      sitemapUrl = normalizeSiteUrl(parsed.data.sitemapUrl).canonicalUrl;
    } catch (error) {
      throw buildSiteValidationError(
        'sitemapUrl',
        error instanceof Error ? error.message : 'Enter a valid sitemap URL',
      );
    }
  }

  return {
    name: parsed.data.name,
    normalizedPrimaryUrl: primaryUrl,
    primaryUrl,
    sitemapUrl,
  };
};

export const createEmptySiteFormState = (): SiteFormState => ({
  values: emptySiteValues,
});

export const toSiteFormState = (
  values: Partial<SiteFormValues> = {},
): SiteFormState => ({
  values: {
    ...emptySiteValues,
    ...values,
  },
});

export const siteValuesFromFormData = (formData: FormData): SiteFormValues => ({
  name: String(formData.get('name') || ''),
  primaryUrl: String(formData.get('primaryUrl') || ''),
  sitemapUrl: String(formData.get('sitemapUrl') || ''),
});

export const toSiteFormErrorState = (
  error: unknown,
  values: SiteFormValues,
): SiteFormState => {
  if (error instanceof SiteValidationError) {
    return {
      fieldErrors: error.fieldErrors,
      formError:
        error.message === 'Site details could not be saved'
          ? undefined
          : error.message,
      values,
    };
  }

  return {
    formError: 'Site details could not be saved right now',
    values,
  };
};

export const listSitesForWorkspace = async (
  context: AuthorizedAppContext,
  prisma: DatabaseClient = getPrismaClient(),
) =>
  prisma.site.findMany({
    where: {
      workspaceId: context.workspace.id,
    },
    orderBy: {
      updatedAt: 'desc',
    },
    select: {
      id: true,
      name: true,
      primaryUrl: true,
      sitemapUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

export const getSiteForWorkspace = async (
  context: AuthorizedAppContext,
  siteId: string,
  prisma: DatabaseClient = getPrismaClient(),
) =>
  prisma.site.findFirst({
    where: {
      id: siteId,
      workspaceId: context.workspace.id,
    },
    select: {
      id: true,
      name: true,
      primaryUrl: true,
      normalizedPrimaryUrl: true,
      sitemapUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

export const createSiteForWorkspace = async (
  context: AuthorizedAppContext,
  values: SiteFormValues,
  prisma: DatabaseClient = getPrismaClient(),
) => {
  const input = parseSiteInput(values);

  try {
    return await prisma.site.create({
      data: {
        workspaceId: context.workspace.id,
        name: input.name,
        primaryUrl: input.primaryUrl,
        normalizedPrimaryUrl: input.normalizedPrimaryUrl,
        sitemapUrl: input.sitemapUrl,
      },
    });
  } catch (error) {
    if (isSiteUniquenessError(error)) {
      throw buildSiteValidationError(
        'primaryUrl',
        'A site with this primary URL already exists in your workspace',
      );
    }

    throw error;
  }
};

export const updateSiteForWorkspace = async (
  context: AuthorizedAppContext,
  siteId: string,
  values: SiteFormValues,
  prisma: DatabaseClient = getPrismaClient(),
) => {
  const input = parseSiteInput(values);

  try {
    const result = await prisma.site.updateMany({
      where: {
        id: siteId,
        workspaceId: context.workspace.id,
      },
      data: {
        name: input.name,
        primaryUrl: input.primaryUrl,
        normalizedPrimaryUrl: input.normalizedPrimaryUrl,
        sitemapUrl: input.sitemapUrl,
      },
    });

    if (result.count === 0) {
      return null;
    }

    return getSiteForWorkspace(context, siteId, prisma);
  } catch (error) {
    if (isSiteUniquenessError(error)) {
      throw buildSiteValidationError(
        'primaryUrl',
        'A site with this primary URL already exists in your workspace',
      );
    }

    throw error;
  }
};

export const deleteSiteForWorkspace = async (
  context: AuthorizedAppContext,
  siteId: string,
  prisma: DatabaseClient = getPrismaClient(),
) => {
  const result = await prisma.site.deleteMany({
    where: {
      id: siteId,
      workspaceId: context.workspace.id,
    },
  });

  return result.count > 0;
};
