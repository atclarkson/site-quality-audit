'use client';

import { useEffect, useState } from 'react';
import type { AuditRunDetail } from '../../../../../../lib/crawl-results';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

type SerializableAuditRunDetail = Omit<
  AuditRunDetail,
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

const isLiveStatus = (status: string) =>
  status === 'QUEUED' || status === 'RUNNING';

export function AuditDetailPanel({
  auditRunId,
  initialAuditRun,
  siteId,
}: {
  auditRunId: string;
  initialAuditRun: SerializableAuditRunDetail;
  siteId: string;
}) {
  const [auditRun, setAuditRun] = useState(initialAuditRun);

  useEffect(() => {
    if (!isLiveStatus(auditRun.status)) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      const response = await fetch(
        `/app/api/sites/${siteId}/audits/${auditRunId}`,
        {
          cache: 'no-store',
        },
      );

      if (!response.ok) {
        return;
      }

      setAuditRun((await response.json()) as SerializableAuditRunDetail);
    }, 2_000);

    return () => window.clearInterval(intervalId);
  }, [auditRun.status, auditRunId, siteId]);

  return (
    <section>
      <h1>Audit detail</h1>
      <p>Status: {auditRun.status}</p>
      <p>Discovered: {auditRun.discoveredUrlCount}</p>
      <p>Queued: {auditRun.queuedUrlCount}</p>
      <p>Crawled: {auditRun.crawledUrlCount}</p>
      <p>Failed: {auditRun.failedUrlCount}</p>
      <p>Excluded: {auditRun.excludedUrlCount}</p>
      <p>
        Total page records:{' '}
        {auditRun.crawledUrlCount +
          auditRun.failedUrlCount +
          auditRun.excludedUrlCount}
      </p>
      <p>Robots.txt status: {auditRun.robotsTxtStatusCode ?? 'Not fetched'}</p>
      <p>Robots.txt URL: {auditRun.robotsTxtUrl || 'Not available'}</p>
      <p>Robots.txt exists: {auditRun.robotsTxtExists ? 'Yes' : 'No'}</p>
      <p>Sitemaps fetched: {auditRun.sitemapCount}</p>
      <p>Sitemap URLs discovered: {auditRun.sitemapUrlCount}</p>
      <p>Sitemap warnings: {auditRun.sitemapWarningCount}</p>
      <p>
        Last progress update:{' '}
        {auditRun.progressUpdatedAt
          ? dateFormatter.format(new Date(auditRun.progressUpdatedAt))
          : 'Not available'}
      </p>
      {auditRun.sitemapWarningMessage ? (
        <p>Sitemap note: {auditRun.sitemapWarningMessage}</p>
      ) : null}
      <p>
        Started:{' '}
        {auditRun.startedAt
          ? dateFormatter.format(new Date(auditRun.startedAt))
          : 'Not started'}
      </p>
      <p>
        Completed:{' '}
        {auditRun.completedAt
          ? dateFormatter.format(new Date(auditRun.completedAt))
          : 'Not completed'}
      </p>
      {auditRun.errorMessage ? <p>Error: {auditRun.errorMessage}</p> : null}
    </section>
  );
}
