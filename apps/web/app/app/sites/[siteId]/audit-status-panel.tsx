'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SerializableSiteAuditSnapshot } from '../../../../lib/audit-management';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const isLiveStatus = (status: string) =>
  status === 'QUEUED' || status === 'RUNNING';

export function AuditStatusPanel({
  initialSnapshot,
  siteId,
}: {
  initialSnapshot: SerializableSiteAuditSnapshot;
  siteId: string;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    if (
      !snapshot.activeAuditRun ||
      !isLiveStatus(snapshot.activeAuditRun.status)
    ) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      const response = await fetch(`/app/api/sites/${siteId}/audits`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        return;
      }

      const nextSnapshot =
        (await response.json()) as SerializableSiteAuditSnapshot;
      setSnapshot(nextSnapshot);
    }, 2_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [siteId, snapshot.activeAuditRun?.id, snapshot.activeAuditRun?.status]);

  return (
    <section>
      <h2>Audit runs</h2>
      {snapshot.activeAuditRun ? (
        <div className="audit-status-card">
          <h3>Current audit</h3>
          <p>Status: {snapshot.activeAuditRun.status}</p>
          <p>Discovered: {snapshot.activeAuditRun.discoveredUrlCount}</p>
          <p>Queued for crawl: {snapshot.activeAuditRun.queuedUrlCount}</p>
          <p>Crawled: {snapshot.activeAuditRun.crawledUrlCount}</p>
          <p>Failed: {snapshot.activeAuditRun.failedUrlCount}</p>
          <p>Excluded: {snapshot.activeAuditRun.excludedUrlCount}</p>
          <p>
            Queued at:{' '}
            {dateFormatter.format(new Date(snapshot.activeAuditRun.createdAt))}
          </p>
          {snapshot.activeAuditRun.startedAt ? (
            <p>
              Started:{' '}
              {dateFormatter.format(
                new Date(snapshot.activeAuditRun.startedAt),
              )}
            </p>
          ) : null}
          {snapshot.activeAuditRun.completedAt ? (
            <p>
              Completed:{' '}
              {dateFormatter.format(
                new Date(snapshot.activeAuditRun.completedAt),
              )}
            </p>
          ) : null}
          {snapshot.activeAuditRun.failedAt ? (
            <p>
              Failed:{' '}
              {dateFormatter.format(new Date(snapshot.activeAuditRun.failedAt))}
            </p>
          ) : null}
          {snapshot.activeAuditRun.errorMessage ? (
            <p>Error: {snapshot.activeAuditRun.errorMessage}</p>
          ) : null}
          <p>
            <Link
              href={`/app/sites/${siteId}/audits/${snapshot.activeAuditRun.id}`}
            >
              View audit detail
            </Link>
          </p>
        </div>
      ) : (
        <p>No audit currently running.</p>
      )}

      {snapshot.recentAuditRuns.length === 0 ? (
        <p>No audits have been run for this site yet.</p>
      ) : (
        <ul className="site-list">
          {snapshot.recentAuditRuns.map((auditRun) => (
            <li key={auditRun.id}>
              <h3>{auditRun.status}</h3>
              <p>
                <Link href={`/app/sites/${siteId}/audits/${auditRun.id}`}>
                  View audit detail
                </Link>
              </p>
              <p>
                Queued: {dateFormatter.format(new Date(auditRun.createdAt))}
              </p>
              <p>Discovered: {auditRun.discoveredUrlCount}</p>
              <p>Crawled: {auditRun.crawledUrlCount}</p>
              <p>Failed: {auditRun.failedUrlCount}</p>
              <p>Excluded: {auditRun.excludedUrlCount}</p>
              {auditRun.startedAt ? (
                <p>
                  Started: {dateFormatter.format(new Date(auditRun.startedAt))}
                </p>
              ) : null}
              {auditRun.completedAt ? (
                <p>
                  Completed:{' '}
                  {dateFormatter.format(new Date(auditRun.completedAt))}
                </p>
              ) : null}
              {auditRun.failedAt ? (
                <p>
                  Failed: {dateFormatter.format(new Date(auditRun.failedAt))}
                </p>
              ) : null}
              {auditRun.errorMessage ? (
                <p>Error: {auditRun.errorMessage}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
