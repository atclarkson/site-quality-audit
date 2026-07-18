-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- AlterTable
ALTER TABLE "audit_runs"
ADD COLUMN     "crawlLimitReached" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "criticalFindingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "findingsGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "highFindingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "infoFindingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lowFindingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mediumFindingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pagesWithFindingsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "robotsWarningCode" TEXT,
ADD COLUMN     "robotsWarningCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "robotsWarningMessage" TEXT,
ADD COLUMN     "sitemapWarningCode" TEXT;

-- CreateTable
CREATE TABLE "findings" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "auditRunId" UUID NOT NULL,
    "crawledPageId" UUID,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "evidenceJson" JSONB,
    "priorityScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "findings_workspaceId_auditRunId_severity_priorityScore_idx" ON "findings"("workspaceId", "auditRunId", "severity", "priorityScore");

-- CreateIndex
CREATE INDEX "findings_workspaceId_auditRunId_crawledPageId_idx" ON "findings"("workspaceId", "auditRunId", "crawledPageId");

-- CreateIndex
CREATE INDEX "findings_workspaceId_siteId_code_idx" ON "findings"("workspaceId", "siteId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "findings_auditRunId_crawledPageId_code_key" ON "findings"("auditRunId", "crawledPageId", "code");

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_auditRunId_fkey" FOREIGN KEY ("auditRunId") REFERENCES "audit_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_crawledPageId_fkey" FOREIGN KEY ("crawledPageId") REFERENCES "crawled_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
