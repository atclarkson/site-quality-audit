import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthorizedAppContext } from '../../../../../../lib/authorized-app-context';
import {
  CRAWLED_PAGE_PAGE_SIZE,
  crawledPageSortOptions,
  getAuditReportForWorkspace,
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
  auditRun: NonNullable<
    Awaited<ReturnType<typeof getAuditReportForWorkspace>>
  >['auditRun'],
) => ({
  ...auditRun,
  completedAt: auditRun.completedAt?.toISOString() || null,
  createdAt: auditRun.createdAt.toISOString(),
  failedAt: auditRun.failedAt?.toISOString() || null,
  findingsGeneratedAt: auditRun.findingsGeneratedAt?.toISOString() || null,
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
  searchParams: Promise<{
    category?: string;
    code?: string;
    direction?: string;
    indexable?: string;
    page?: string;
    q?: string;
    severity?: string;
    sort?: string;
  }>;
}) {
  const context = await getAuthorizedAppContext();

  if (!context) {
    redirect('/');
  }

  const [{ auditRunId, siteId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);

  const report = await getAuditReportForWorkspace(context, siteId, auditRunId, {
    category: resolvedSearchParams.category,
    code: resolvedSearchParams.code,
    indexableOnly: resolvedSearchParams.indexable === 'true',
    search: resolvedSearchParams.q,
    severity: resolvedSearchParams.severity,
  });

  if (!report) {
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
  const filterQuery = new URLSearchParams();

  if (report.appliedFilters.severity) {
    filterQuery.set('severity', report.appliedFilters.severity);
  }

  if (report.appliedFilters.category) {
    filterQuery.set('category', report.appliedFilters.category);
  }

  if (report.appliedFilters.code) {
    filterQuery.set('code', report.appliedFilters.code);
  }

  if (report.appliedFilters.indexableOnly) {
    filterQuery.set('indexable', 'true');
  }

  if (report.appliedFilters.search) {
    filterQuery.set('q', report.appliedFilters.search);
  }

  const nextDirection = direction === 'asc' ? 'desc' : 'asc';
  const filterSuffix = filterQuery.toString();
  const queryPrefix = filterSuffix ? `${filterSuffix}&` : '';

  return (
    <main>
      <section className="page-shell">
        <p>
          <Link href={`/app/sites/${siteId}`}>Back to site</Link>
        </p>

        <AuditDetailPanel
          auditRunId={auditRunId}
          initialAuditRun={toSerializableAuditRun(report.auditRun)}
          siteId={siteId}
        />

        <section className="report-section">
          <div className="section-heading">
            <div>
              <h2>Fix these pages first</h2>
              <p>
                Triage scores help decide what to inspect first. They are not
                search-engine ranking scores.
              </p>
            </div>
          </div>

          <form className="filter-bar" method="get">
            <input
              type="search"
              name="q"
              placeholder="Search URL or title"
              defaultValue={report.appliedFilters.search}
            />
            <select
              name="severity"
              defaultValue={report.appliedFilters.severity || ''}
            >
              <option value="">All severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
              <option value="INFO">Info</option>
            </select>
            <select
              name="category"
              defaultValue={report.appliedFilters.category || ''}
            >
              <option value="">All categories</option>
              {report.availableCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select name="code" defaultValue={report.appliedFilters.code || ''}>
              <option value="">All issue codes</option>
              {report.availableCodes.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <label className="inline-checkbox">
              <input
                type="checkbox"
                name="indexable"
                value="true"
                defaultChecked={report.appliedFilters.indexableOnly}
              />
              Indexable pages only
            </label>
            <button type="submit">Apply filters</button>
          </form>

          {report.topPriorityPages.length === 0 ? (
            <p>No pages matched the current finding filters.</p>
          ) : (
            <div className="stack-list">
              {report.topPriorityPages.map((pageSummary) => (
                <article
                  key={pageSummary.crawledPageId}
                  className="priority-card"
                >
                  <div className="priority-header">
                    <span className="priority-score">
                      Priority {pageSummary.priorityScore}
                    </span>
                    <span
                      className={`severity-badge severity-${pageSummary.highestSeverity.toLowerCase()}`}
                    >
                      {pageSummary.highestSeverity}
                    </span>
                  </div>
                  <h3>
                    <Link
                      href={`/app/sites/${siteId}/audits/${auditRunId}/pages/${pageSummary.crawledPageId}`}
                    >
                      {pageSummary.title || pageSummary.url}
                    </Link>
                  </h3>
                  <p className="muted">{pageSummary.url}</p>
                  <p>{pageSummary.findingCount} findings on this page</p>
                  <p className="muted">
                    {pageSummary.topFindingTitles.join(' • ')}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="report-section">
          <h2>Findings by issue</h2>
          {report.findingsByIssue.length === 0 ? (
            <p>No findings matched the current filters.</p>
          ) : (
            <div className="stack-list">
              {report.findingsByIssue.map((group) => (
                <details
                  key={`${group.code}:${group.severity}`}
                  className="issue-card"
                >
                  <summary>
                    <span
                      className={`severity-badge severity-${group.severity.toLowerCase()}`}
                    >
                      {group.severity}
                    </span>
                    <span>{group.title}</span>
                    <span className="muted">
                      {group.affectedPageCount} affected pages
                    </span>
                  </summary>
                  <p>{group.explanation}</p>
                  <p>
                    <strong>Recommended action:</strong>{' '}
                    {group.recommendedAction}
                  </p>
                  {group.pages.length > 0 ? (
                    <ul className="issue-page-list">
                      {group.pages.map((pageRecord) => (
                        <li key={`${group.code}:${pageRecord.crawledPageId}`}>
                          <Link
                            href={`/app/sites/${siteId}/audits/${auditRunId}/pages/${pageRecord.crawledPageId}`}
                          >
                            {pageRecord.title || pageRecord.url}
                          </Link>
                          <span className="muted">
                            {' '}
                            ({pageRecord.priorityScore}) {pageRecord.url}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </details>
              ))}
            </div>
          )}
        </section>

        <details className="report-section">
          <summary>Technical page inventory</summary>
          <p>
            Showing page {pageResults.page} of {pageResults.totalPages}. Sorted
            by {sortLabels[sort]} ({direction}).
          </p>
          <div className="actions">
            {(Object.keys(crawledPageSortOptions) as CrawledPageSortKey[]).map(
              (sortKey) => (
                <Link
                  key={sortKey}
                  href={`/app/sites/${siteId}/audits/${auditRunId}?${queryPrefix}page=1&sort=${sortKey}&direction=${
                    sortKey === sort ? nextDirection : 'asc'
                  }`}
                >
                  Sort by {sortLabels[sortKey]}
                </Link>
              ),
            )}
          </div>
          <div className="table-wrap">
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
          </div>

          <div className="actions">
            {pageResults.page > 1 ? (
              <Link
                href={`/app/sites/${siteId}/audits/${auditRunId}?${queryPrefix}page=${pageResults.page - 1}&sort=${sort}&direction=${direction}`}
              >
                Previous
              </Link>
            ) : null}
            {pageResults.page < pageResults.totalPages ? (
              <Link
                href={`/app/sites/${siteId}/audits/${auditRunId}?${queryPrefix}page=${pageResults.page + 1}&sort=${sort}&direction=${direction}`}
              >
                Next
              </Link>
            ) : null}
          </div>
        </details>
      </section>
    </main>
  );
}
