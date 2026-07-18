-- DropForeignKey
ALTER TABLE "audit_runs" DROP CONSTRAINT "audit_runs_requestedByUserId_fkey";

-- AlterTable
ALTER TABLE "audit_runs" ALTER COLUMN "requestedByUserId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "audit_runs_active_siteId_key" ON "audit_runs"("siteId") WHERE "status" IN ('QUEUED', 'RUNNING');

-- AddForeignKey
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
