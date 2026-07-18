import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as {
  prisma?: PrismaClient;
};

export { DATABASE_PROVIDER } from './provider';

export type DatabaseClient = PrismaClient;

export const createPrismaClient = (options?: { datasourceUrl?: string }) =>
  new PrismaClient(
    options?.datasourceUrl
      ? {
          datasources: {
            db: {
              url: options.datasourceUrl,
            },
          },
        }
      : undefined,
  );

export const getPrismaClient = () => {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
};

export { MembershipRole, Prisma } from '@prisma/client';
