import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthorizedAppContext } from '../../../../../../lib/authorized-app-context';
import {
  CRAWLED_PAGE_PAGE_SIZE,
  crawledPageSortOptions,
  getAuditRunForWorkspace,
  listCrawledPagesForAudit,
  type CrawledPageSortKey,
} from '../../../../../../lib/crawl-results';
import { AuditDetailPanel } from './audit-detail-panel';

const sortLabels: Record<CrawledPageSortKey, string> = {
  responseTime: 'Response time',
  status: 'HTTP status',
  url: 'URL',
  wordCount: 'Word count',
};

const toSerializableAuditRun = (
  auditRun: NonNullable<Awaited<ReturnType<typeof getAuditRunForWorkspace>>>,
) => ({
  ...auditRun,
  completedAt: auditRun.completedAt?.toISOString() || null,
  createdAt: auditRun.createdAt.toISOString(),
  failedAt: auditRun.failedAt?.toISOString() || null,
  progressUpdatedAt: auditRun.progressUpdatedAt?.toISOString() || null,
  robotsTxtFetchedAt: auditRun.robotsTxtFetchedAt?.toISOString() || null,
  startedAt: auditRun.startedAt?.toISOString() || null,
  updatedAt: auditRun.updatedAt.toISOString(),
});

export default async function AuditDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ auditRunId: string; siteId: string }>;
  searchParams: Promise<{ direction?: string; page?: string; sort?: string }>;
}) {
  const context = await getAuthorizedAppContext();

  if (!context) {
    redirect('/');
  }

  const [{ auditRunId, siteId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const auditRun = await getAuditRunForWorkspace(context, siteId, auditRunId);

  if (!auditRun) {
    redirect(`/app/sites/${siteId}`);
  }

  const sort =
    resolvedSearchParams.sort &&
    resolvedSearchParams.sort in crawledPageSortOptions
      ? (resolvedSearchParams.sort as CrawledPageSortKey)
      : 'url';
  const direction = resolvedSearchParams.direction === 'desc' ? 'desc' : 'asc';
  const page = Number.parseInt(resolvedSearchParams.page || '1', 10) || 1;
  const pageResults = await listCrawledPagesForAudit(
    context,
    siteId,
    auditRunId,
    {
      direction,
      page,
      pageSize: CRAWLED_PAGE_PAGE_SIZE,
      sort,
    },
  );
  const totalPageRecords =
    auditRun.crawledUrlCount +
    auditRun.failedUrlCount +
    auditRun.excludedUrlCount;
  const nextDirection = direction === 'asc' ? 'desc' : 'asc';

  return (
    <main>
      <section>
        <p>
          <Link href={`/app/sites/${siteId}`}>Back to site</Link>
        </p>

        <AuditDetailPanel
          auditRunId={auditRunId}
          initialAuditRun={toSerializableAuditRun(auditRun)}
          siteId={siteId}
        />

        <section>
          <h2>Page inventory</h2>
          <p>Total page records: {totalPageRecords}</p>
          <p>
            Showing page {pageResults.page} of {pageResults.totalPages}. Sorted
            by {sortLabels[sort]} ({direction}).
          </p>
          <div className="actions">
            {(Object.keys(crawledPageSortOptions) as CrawledPageSortKey[]).map(
              (sortKey) => (
                <Link
                  key={sortKey}
                  href={`/app/sites/${siteId}/audits/${auditRunId}?page=1&sort=${sortKey}&direction=${
                    sortKey === sort ? nextDirection : 'asc'
                  }`}
                >
                  Sort by {sortLabels[sortKey]}
                </Link>
              ),
            )}
          </div>
          <table>
            <thead>
              <tr>
                <th>URL</th>
                <th>HTTP status</th>
                <th>Title</th>
                <th>Word count</th>
                <th>Indexable</th>
                <th>H1 count</th>
                <th>Response time</th>
                <th>Fetch status</th>
              </tr>
            </thead>
            <tbody>
              {pageResults.pages.map((pageRecord) => (
                <tr key={pageRecord.id}>
                  <td>
                    <Link
                      href={`/app/sites/${siteId}/audits/${auditRunId}/pages/${pageRecord.id}`}
                    >
                      {pageRecord.normalizedUrl}
                    </Link>
                  </td>
                  <td>{pageRecord.statusCode ?? 'n/a'}</td>
                  <td>{pageRecord.title || 'Untitled'}</td>
                  <td>{pageRecord.visibleWordCount}</td>
                  <td>{pageRecord.isIndexable ? 'Yes' : 'No'}</td>
                  <td>{pageRecord.h1Count}</td>
                  <td>
                    {pageRecord.responseTimeMs !== null
                      ? `${pageRecord.responseTimeMs} ms`
                      : 'n/a'}
                  </td>
                  <td>{pageRecord.fetchStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="actions">
            {pageResults.page > 1 ? (
              <Link
                href={`/app/sites/${siteId}/audits/${auditRunId}?page=${pageResults.page - 1}&sort=${sort}&direction=${direction}`}
              >
                Previous
              </Link>
            ) : null}
            {pageResults.page < pageResults.totalPages ? (
              <Link
                href={`/app/sites/${siteId}/audits/${auditRunId}?page=${pageResults.page + 1}&sort=${sort}&direction=${direction}`}
              >
                Next
              </Link>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
