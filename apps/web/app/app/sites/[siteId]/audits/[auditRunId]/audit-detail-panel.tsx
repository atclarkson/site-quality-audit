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
  | 'findingsGeneratedAt'
  | 'progressUpdatedAt'
  | 'robotsTxtFetchedAt'
  | 'startedAt'
  | 'updatedAt'
> & {
  completedAt: string | null;
  createdAt: string;
  failedAt: string | null;
  findingsGeneratedAt: string | null;
  progressUpdatedAt: string | null;
  robotsTxtFetchedAt: string | null;
  startedAt: string | null;
  updatedAt: string;
};

const isLiveStatus = (status: string) =>
  status === 'QUEUED' || status === 'RUNNING';

const summaryStats = (auditRun: SerializableAuditRunDetail) => [
  { label: 'Total pages crawled', value: auditRun.crawledUrlCount },
  { label: 'Pages with findings', value: auditRun.pagesWithFindingsCount },
  { label: 'Critical', value: auditRun.criticalFindingCount },
  { label: 'High', value: auditRun.highFindingCount },
  { label: 'Medium', value: auditRun.mediumFindingCount },
  { label: 'Low', value: auditRun.lowFindingCount },
  { label: 'Failed pages', value: auditRun.failedUrlCount },
  { label: 'Excluded pages', value: auditRun.excludedUrlCount },
];

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
    <section className="report-section">
      <div className="section-heading">
        <div>
          <h1>Prioritized audit report</h1>
          <p>
            Status: <strong>{auditRun.status}</strong>
          </p>
        </div>
      </div>

      <div className="summary-grid">
        {summaryStats(auditRun).map((stat) => (
          <article key={stat.label} className="summary-card">
            <span className="summary-label">{stat.label}</span>
            <strong className="summary-value">{stat.value}</strong>
          </article>
        ))}
      </div>

      <div className="site-meta compact-meta">
        <div>
          <dt>Queued</dt>
          <dd>{dateFormatter.format(new Date(auditRun.createdAt))}</dd>
        </div>
        <div>
          <dt>Started</dt>
          <dd>
            {auditRun.startedAt
              ? dateFormatter.format(new Date(auditRun.startedAt))
              : 'Not started'}
          </dd>
        </div>
        <div>
          <dt>Completed</dt>
          <dd>
            {auditRun.completedAt
              ? dateFormatter.format(new Date(auditRun.completedAt))
              : 'Not completed'}
          </dd>
        </div>
        <div>
          <dt>Findings generated</dt>
          <dd>
            {auditRun.findingsGeneratedAt
              ? dateFormatter.format(new Date(auditRun.findingsGeneratedAt))
              : 'Not yet'}
          </dd>
        </div>
        <div>
          <dt>Robots.txt</dt>
          <dd>{auditRun.robotsTxtStatusCode ?? 'Not fetched'}</dd>
        </div>
        <div>
          <dt>Sitemaps</dt>
          <dd>
            {auditRun.sitemapCount} fetched, {auditRun.sitemapUrlCount} URLs
          </dd>
        </div>
      </div>

      {auditRun.errorMessage ? <p>Error: {auditRun.errorMessage}</p> : null}
    </section>
  );
}
