import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthorizedAppContext } from '../../../../lib/authorized-app-context';
import {
  getAuditSnapshotForSite,
  toSerializableAuditSnapshot,
} from '../../../../lib/audit-management';
import {
  deleteSiteAction,
  startAuditAction,
} from '../../../../lib/site-actions';
import { getSiteForWorkspace } from '../../../../lib/site-management';
import { AuditStatusPanel } from './audit-status-panel';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const context = await getAuthorizedAppContext();

  if (!context) {
    redirect('/');
  }

  const { siteId } = await params;
  const site = await getSiteForWorkspace(context, siteId);

  if (!site) {
    redirect('/app');
  }

  const auditSnapshot = await getAuditSnapshotForSite(context, siteId);

  if (!auditSnapshot) {
    redirect('/app');
  }

  const deleteAction = deleteSiteAction.bind(null, siteId);
  const startAction = startAuditAction.bind(null, siteId);

  return (
    <main>
      <section>
        <p>
          <Link href="/app">Back to workspace</Link>
        </p>
        <h1>{site.name}</h1>
        <dl className="site-meta">
          <div>
            <dt>Primary URL</dt>
            <dd>{site.primaryUrl}</dd>
          </div>
          <div>
            <dt>Sitemap URL</dt>
            <dd>{site.sitemapUrl || 'Not provided'}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{dateFormatter.format(site.createdAt)}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{dateFormatter.format(site.updatedAt)}</dd>
          </div>
        </dl>

        <div className="actions">
          <Link href={`/app/sites/${site.id}/edit`}>Edit site</Link>
          <form action={startAction}>
            <button type="submit">Start audit</button>
          </form>
        </div>

        <AuditStatusPanel
          initialSnapshot={toSerializableAuditSnapshot(auditSnapshot)}
          siteId={siteId}
        />

        <details className="danger-zone">
          <summary>Delete site</summary>
          <p>
            This removes the site record from your workspace. It does not affect
            any other workspace.
          </p>
          <form action={deleteAction}>
            <button type="submit" className="danger-button">
              Confirm delete
            </button>
          </form>
        </details>
      </section>
    </main>
  );
}
