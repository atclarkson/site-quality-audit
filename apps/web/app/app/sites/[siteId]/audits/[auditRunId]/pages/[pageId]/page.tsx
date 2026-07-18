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
      <section>
        <p>
          <Link href={`/app/sites/${siteId}/audits/${auditRunId}`}>
            Back to audit
          </Link>
        </p>
        <h1>{pageRecord.normalizedUrl}</h1>
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
            <dt>Title</dt>
            <dd>{pageRecord.title || 'Untitled'}</dd>
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
      </section>
    </main>
  );
}
