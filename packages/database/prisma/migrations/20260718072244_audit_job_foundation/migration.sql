-- CreateEnum
CREATE TYPE "AuditRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "audit_runs" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "requestedByUserId" UUID NOT NULL,
    "status" "AuditRunStatus" NOT NULL,
    "queueJobId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audit_runs_queueJobId_key" ON "audit_runs"("queueJobId");

-- CreateIndex
CREATE INDEX "audit_runs_workspaceId_siteId_createdAt_idx" ON "audit_runs"("workspaceId", "siteId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_runs_siteId_status_idx" ON "audit_runs"("siteId", "status");

-- AddForeignKey
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
