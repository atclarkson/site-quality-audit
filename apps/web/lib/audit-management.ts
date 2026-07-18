import { getWebEnv } from '@site-quality-audit/config';
import {
  AuditRunStatus,
  Prisma,
  getPrismaClient,
  type DatabaseClient,
} from '@site-quality-audit/database';
import { WEB_SERVICE_NAME } from '@site-quality-audit/domain';
import {
  AUDIT_QUEUE_ERROR_CODE,
  AUDIT_QUEUE_ERROR_MESSAGE,
  RUN_SITE_AUDIT_JOB_NAME,
  auditJobPayloadSchema,
  createAuditQueue,
  getAuditJobId,
  type AuditJobPayload,
} from '@site-quality-audit/queue';
import { createLogger } from '@site-quality-audit/logging';
import type { AuthorizedAppContext } from './authorized-app-context';

const logger = createLogger({ service: WEB_SERVICE_NAME });

const activeAuditStatuses = [AuditRunStatus.QUEUED, AuditRunStatus.RUNNING];

const auditRunSummarySelect = {
  id: true,
  status: true,
  queueJobId: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  completedAt: true,
  failedAt: true,
  discoveredUrlCount: true,
  queuedUrlCount: true,
  crawledUrlCount: true,
  failedUrlCount: true,
  excludedUrlCount: true,
  progressUpdatedAt: true,
  robotsTxtUrl: true,
  robotsTxtStatusCode: true,
  robotsTxtFetchedAt: true,
  robotsTxtExists: true,
  sitemapCount: true,
  sitemapUrlCount: true,
  sitemapWarningCount: true,
  sitemapWarningMessage: true,
  criticalFindingCount: true,
  highFindingCount: true,
  mediumFindingCount: true,
  lowFindingCount: true,
  infoFindingCount: true,
  pagesWithFindingsCount: true,
  findingsGeneratedAt: true,
  errorCode: true,
  errorMessage: true,
} satisfies Prisma.AuditRunSelect;

export type SiteAuditRunSummary = Prisma.AuditRunGetPayload<{
  select: typeof auditRunSummarySelect;
}>;

export type SiteAuditSnapshot = {
  activeAuditRun: SiteAuditRunSummary | null;
  recentAuditRuns: SiteAuditRunSummary[];
};

export type SerializableSiteAuditRunSummary = Omit<
  SiteAuditRunSummary,
  | 'completedAt'
  | 'createdAt'
  | 'failedAt'
  | 'progressUpdatedAt'
  | 'robotsTxtFetchedAt'
  | 'startedAt'
  | 'updatedAt'
> & {
  completedAt: string | null;
  createdAt: string;
  failedAt: string | null;
  progressUpdatedAt: string | null;
  robotsTxtFetchedAt: string | null;
  startedAt: string | null;
  updatedAt: string;
};

export type SerializableSiteAuditSnapshot = {
  activeAuditRun: SerializableSiteAuditRunSummary | null;
  recentAuditRuns: SerializableSiteAuditRunSummary[];
};

type EnqueueAuditJob = (payload: AuditJobPayload) => Promise<string>;
type AuditLogger = Pick<typeof logger, 'error'>;

const isUniquenessError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002';

const buildQueueFailure = (error: unknown) => ({
  errorCode: AUDIT_QUEUE_ERROR_CODE,
  errorMessage: AUDIT_QUEUE_ERROR_MESSAGE,
  errorName: error instanceof Error ? error.name : 'UnknownError',
});

const enqueueAuditJob: EnqueueAuditJob = async (payload) => {
  const { connection, queue } = createAuditQueue(getWebEnv().REDIS_URL);

  try {
    const job = await queue.add(
      RUN_SITE_AUDIT_JOB_NAME,
      auditJobPayloadSchema.parse(payload),
      {
        jobId: getAuditJobId(payload.auditRunId),
      },
    );

    return job.id!;
  } finally {
    await queue.close();
    await connection.quit();
  }
};

const getSiteWorkspaceRecord = async (
  context: AuthorizedAppContext,
  siteId: string,
  prisma: DatabaseClient | Prisma.TransactionClient,
) =>
  prisma.site.findFirst({
    where: {
      id: siteId,
      workspaceId: context.workspace.id,
    },
    select: {
      id: true,
      workspaceId: true,
    },
  });

export const getAuditSnapshotForSite = async (
  context: AuthorizedAppContext,
  siteId: string,
  prisma: DatabaseClient = getPrismaClient(),
): Promise<SiteAuditSnapshot | null> => {
  const site = await getSiteWorkspaceRecord(context, siteId, prisma);

  if (!site) {
    return null;
  }

  const [activeAuditRun, recentAuditRuns] = await Promise.all([
    prisma.auditRun.findFirst({
      where: {
        siteId,
        workspaceId: context.workspace.id,
        status: {
          in: activeAuditStatuses,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: auditRunSummarySelect,
    }),
    prisma.auditRun.findMany({
      where: {
        siteId,
        workspaceId: context.workspace.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
      select: auditRunSummarySelect,
    }),
  ]);

  return {
    activeAuditRun,
    recentAuditRuns,
  };
};

const serializeAuditRunSummary = (
  auditRun: SiteAuditRunSummary,
): SerializableSiteAuditRunSummary => ({
  ...auditRun,
  completedAt: auditRun.completedAt?.toISOString() || null,
  createdAt: auditRun.createdAt.toISOString(),
  failedAt: auditRun.failedAt?.toISOString() || null,
  progressUpdatedAt: auditRun.progressUpdatedAt?.toISOString() || null,
  robotsTxtFetchedAt: auditRun.robotsTxtFetchedAt?.toISOString() || null,
  startedAt: auditRun.startedAt?.toISOString() || null,
  updatedAt: auditRun.updatedAt.toISOString(),
});

export const toSerializableAuditSnapshot = (
  snapshot: SiteAuditSnapshot,
): SerializableSiteAuditSnapshot => ({
  activeAuditRun: snapshot.activeAuditRun
    ? serializeAuditRunSummary(snapshot.activeAuditRun)
    : null,
  recentAuditRuns: snapshot.recentAuditRuns.map(serializeAuditRunSummary),
});

export const startAuditForSite = async (
  context: AuthorizedAppContext,
  siteId: string,
  {
    enqueueAuditJobImpl = enqueueAuditJob,
    loggerImpl = logger,
    prisma = getPrismaClient(),
  }: {
    enqueueAuditJobImpl?: EnqueueAuditJob;
    loggerImpl?: AuditLogger;
    prisma?: DatabaseClient;
  } = {},
) => {
  const findActiveAuditRun = () =>
    prisma.auditRun.findFirst({
      where: {
        siteId,
        workspaceId: context.workspace.id,
        status: {
          in: activeAuditStatuses,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: auditRunSummarySelect,
    });

  const creationResult = await (async () => {
    try {
      return await prisma.$transaction(async (tx) => {
        const site = await getSiteWorkspaceRecord(context, siteId, tx);

        if (!site) {
          return null;
        }

        const existingAuditRun = await tx.auditRun.findFirst({
          where: {
            siteId,
            workspaceId: context.workspace.id,
            status: {
              in: activeAuditStatuses,
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: auditRunSummarySelect,
        });

        if (existingAuditRun) {
          return {
            auditRun: existingAuditRun,
            created: false,
          };
        }

        return {
          auditRun: await tx.auditRun.create({
            data: {
              requestedByUserId: context.user.id,
              siteId,
              status: AuditRunStatus.QUEUED,
              workspaceId: context.workspace.id,
            },
            select: auditRunSummarySelect,
          }),
          created: true,
        };
      });
    } catch (error) {
      if (!isUniquenessError(error)) {
        throw error;
      }

      const activeAuditRun = await findActiveAuditRun();

      if (!activeAuditRun) {
        throw error;
      }

      return {
        auditRun: activeAuditRun,
        created: false,
      };
    }
  })();

  if (!creationResult) {
    return null;
  }

  if (!creationResult.created) {
    return creationResult.auditRun;
  }

  const payload = auditJobPayloadSchema.parse({
    auditRunId: creationResult.auditRun.id,
    siteId,
    workspaceId: context.workspace.id,
  });

  try {
    const queueJobId = await enqueueAuditJobImpl(payload);

    return prisma.auditRun.update({
      where: {
        id: creationResult.auditRun.id,
      },
      data: {
        queueJobId,
      },
      select: auditRunSummarySelect,
    });
  } catch (error) {
    const failure = buildQueueFailure(error);

    loggerImpl.error('audit.enqueue_failed', {
      auditRunId: creationResult.auditRun.id,
      errorCode: failure.errorCode,
      errorName: failure.errorName,
      siteId,
      workspaceId: context.workspace.id,
    });

    await prisma.auditRun.update({
      where: {
        id: creationResult.auditRun.id,
      },
      data: {
        status: AuditRunStatus.FAILED,
        failedAt: new Date(),
        errorCode: failure.errorCode,
        errorMessage: failure.errorMessage,
      },
      select: auditRunSummarySelect,
    });

    throw error;
  }
};
