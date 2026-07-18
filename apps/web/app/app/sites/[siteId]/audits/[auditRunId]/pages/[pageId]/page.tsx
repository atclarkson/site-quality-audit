import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthorizedAppContext } from '../../../../../../../../lib/authorized-app-context';
import { getCrawledPageForAudit } from '../../../../../../../../lib/crawl-results';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export default async function CrawledPageDetailPage({
  params,
}: {
  params: Promise<{ auditRunId: string; pageId: string; siteId: string }>;
}) {
  const context = await getAuthorizedAppContext();

  if (!context) {
    redirect('/');
  }

  const { auditRunId, pageId, siteId } = await params;
  const pageRecord = await getCrawledPageForAudit(
    context,
    siteId,
    auditRunId,
    pageId,
  );

  if (!pageRecord) {
    redirect(`/app/sites/${siteId}/audits/${auditRunId}`);
  }

  return (
    <main>
      <section className="page-shell">
        <p>
          <Link href={`/app/sites/${siteId}/audits/${auditRunId}`}>
            Back to audit
          </Link>
        </p>

        <section className="report-section">
          <div className="priority-header">
            <span className="priority-score">
              Priority {pageRecord.findingSummary.priorityScore}
            </span>
            {pageRecord.findingSummary.highestSeverity ? (
              <span
                className={`severity-badge severity-${pageRecord.findingSummary.highestSeverity.toLowerCase()}`}
              >
                {pageRecord.findingSummary.highestSeverity}
              </span>
            ) : null}
          </div>
          <h1>{pageRecord.title || pageRecord.normalizedUrl}</h1>
          <p className="muted">{pageRecord.normalizedUrl}</p>
          <p>{pageRecord.findingSummary.findingCount} findings on this page</p>
        </section>

        <section className="report-section">
          <h2>Findings and recommended actions</h2>
          {pageRecord.findings.length === 0 ? (
            <p>No findings were generated for this page.</p>
          ) : (
            <div className="stack-list">
              {pageRecord.findings.map((finding) => (
                <article
                  key={`${finding.code}:${finding.title}`}
                  className="issue-card issue-card-open"
                >
                  <div className="priority-header">
                    <span
                      className={`severity-badge severity-${finding.severity.toLowerCase()}`}
                    >
                      {finding.severity}
                    </span>
                    <span className="priority-score">
                      Priority {finding.priorityScore}
                    </span>
                  </div>
                  <h3>{finding.title}</h3>
                  <p>{finding.explanation}</p>
                  <p>
                    <strong>Recommended action:</strong>{' '}
                    {finding.recommendedAction}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        <details className="report-section">
          <summary>Technical details</summary>
          <dl className="site-meta">
            <div>
              <dt>Requested URL</dt>
              <dd>{pageRecord.requestedUrl}</dd>
            </div>
            <div>
              <dt>Final URL</dt>
              <dd>{pageRecord.finalUrl || 'Not available'}</dd>
            </div>
            <div>
              <dt>Fetch status</dt>
              <dd>{pageRecord.fetchStatus}</dd>
            </div>
            <div>
              <dt>HTTP status</dt>
              <dd>{pageRecord.statusCode ?? 'n/a'}</dd>
            </div>
            <div>
              <dt>Meta description</dt>
              <dd>{pageRecord.metaDescription || 'Not present'}</dd>
            </div>
            <div>
              <dt>Canonical URL</dt>
              <dd>{pageRecord.canonicalUrl || 'Not present'}</dd>
            </div>
            <div>
              <dt>Canonical warning</dt>
              <dd>{pageRecord.canonicalWarningMessage || 'None'}</dd>
            </div>
            <div>
              <dt>Robots meta</dt>
              <dd>{pageRecord.metaRobots || 'Not present'}</dd>
            </div>
            <div>
              <dt>X-Robots-Tag</dt>
              <dd>{pageRecord.xRobotsTag || 'Not present'}</dd>
            </div>
            <div>
              <dt>HTML lang</dt>
              <dd>{pageRecord.htmlLang || 'Not present'}</dd>
            </div>
            <div>
              <dt>First H1</dt>
              <dd>{pageRecord.firstH1 || 'Not present'}</dd>
            </div>
            <div>
              <dt>Visible word count</dt>
              <dd>{pageRecord.visibleWordCount}</dd>
            </div>
            <div>
              <dt>Internal links</dt>
              <dd>{pageRecord.internalLinkCount}</dd>
            </div>
            <div>
              <dt>Images missing alt</dt>
              <dd>{pageRecord.imagesMissingAltCount}</dd>
            </div>
            <div>
              <dt>Response time</dt>
              <dd>
                {pageRecord.responseTimeMs !== null
                  ? `${pageRecord.responseTimeMs} ms`
                  : 'n/a'}
              </dd>
            </div>
            <div>
              <dt>Fetched at</dt>
              <dd>
                {pageRecord.fetchedAt
                  ? dateFormatter.format(pageRecord.fetchedAt)
                  : 'Not fetched'}
              </dd>
            </div>
            <div>
              <dt>Safe error</dt>
              <dd>{pageRecord.errorMessage || 'None'}</dd>
            </div>
          </dl>
        </details>
      </section>
    </main>
  );
}
