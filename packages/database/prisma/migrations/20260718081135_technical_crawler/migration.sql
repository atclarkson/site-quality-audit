-- CreateEnum
CREATE TYPE "CrawledPageFetchStatus" AS ENUM ('SUCCESS', 'NON_HTML', 'FAILED', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "CrawledPageDiscoverySource" AS ENUM ('PRIMARY', 'SITEMAP', 'LINK');

-- AlterTable
ALTER TABLE "audit_runs" ADD COLUMN     "crawledUrlCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discoveredUrlCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "excludedUrlCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "failedUrlCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "progressUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "queuedUrlCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "robotsTxtExists" BOOLEAN,
ADD COLUMN     "robotsTxtFetchedAt" TIMESTAMP(3),
ADD COLUMN     "robotsTxtStatusCode" INTEGER,
ADD COLUMN     "robotsTxtUrl" TEXT,
ADD COLUMN     "sitemapCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sitemapUrlCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sitemapWarningCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sitemapWarningMessage" TEXT;

-- CreateTable
CREATE TABLE "crawled_pages" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "auditRunId" UUID NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "requestedUrl" TEXT NOT NULL,
    "finalUrl" TEXT,
    "statusCode" INTEGER,
    "contentType" TEXT,
    "responseTimeMs" INTEGER,
    "responseSizeBytes" INTEGER,
    "redirectCount" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "titleLength" INTEGER,
    "metaDescription" TEXT,
    "metaDescriptionLength" INTEGER,
    "canonicalUrl" TEXT,
    "canonicalWarningCode" TEXT,
    "canonicalWarningMessage" TEXT,
    "metaRobots" TEXT,
    "xRobotsTag" TEXT,
    "htmlLang" TEXT,
    "h1Count" INTEGER NOT NULL DEFAULT 0,
    "firstH1" TEXT,
    "h2Count" INTEGER NOT NULL DEFAULT 0,
    "visibleWordCount" INTEGER NOT NULL DEFAULT 0,
    "internalLinkCount" INTEGER NOT NULL DEFAULT 0,
    "externalLinkCount" INTEGER NOT NULL DEFAULT 0,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "imagesMissingAltCount" INTEGER NOT NULL DEFAULT 0,
    "structuredDataCount" INTEGER NOT NULL DEFAULT 0,
    "openGraphTitle" TEXT,
    "openGraphDescription" TEXT,
    "hasViewportMeta" BOOLEAN NOT NULL DEFAULT false,
    "isIndexable" BOOLEAN NOT NULL DEFAULT true,
    "crawlDepth" INTEGER NOT NULL DEFAULT 0,
    "discoverySource" "CrawledPageDiscoverySource" NOT NULL,
    "fetchStatus" "CrawledPageFetchStatus" NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "fetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crawled_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crawled_pages_workspaceId_auditRunId_normalizedUrl_idx" ON "crawled_pages"("workspaceId", "auditRunId", "normalizedUrl");

-- CreateIndex
CREATE INDEX "crawled_pages_workspaceId_siteId_auditRunId_fetchStatus_idx" ON "crawled_pages"("workspaceId", "siteId", "auditRunId", "fetchStatus");

-- CreateIndex
CREATE UNIQUE INDEX "crawled_pages_auditRunId_normalizedUrl_key" ON "crawled_pages"("auditRunId", "normalizedUrl");

-- AddForeignKey
ALTER TABLE "crawled_pages" ADD CONSTRAINT "crawled_pages_auditRunId_fkey" FOREIGN KEY ("auditRunId") REFERENCES "audit_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawled_pages" ADD CONSTRAINT "crawled_pages_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawled_pages" ADD CONSTRAINT "crawled_pages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
