import Link from 'next/link';
import { redirect } from 'next/navigation';
import { APP_NAME } from '@site-quality-audit/domain';
import { getAuthorizedAppContext } from '../../lib/authorized-app-context';
import { listSitesForWorkspace } from '../../lib/site-management';
import { SignOutButton } from '../sign-out-button';

export default async function AppPage() {
  const context = await getAuthorizedAppContext();

  if (!context) {
    redirect('/');
  }

  const sites = await listSitesForWorkspace(context);

  return (
    <main>
      <section>
        <p>{APP_NAME}</p>
        <h1>{context.workspace.name}</h1>
        <p>Signed in as {context.user.name || context.user.email}</p>
        <p>Role: {context.role}</p>
        <div className="actions">
          <Link href="/app/sites/new">Add a site</Link>
          <Link href="/">Back to home</Link>
        </div>

        <h2>Sites</h2>
        {sites.length === 0 ? (
          <p>
            No sites yet. Add your first site to start building this workspace.
          </p>
        ) : (
          <ul className="site-list">
            {sites.map((site) => (
              <li key={site.id}>
                <h3>
                  <Link href={`/app/sites/${site.id}`}>{site.name}</Link>
                </h3>
                <p>{site.primaryUrl}</p>
                {site.sitemapUrl ? <p>Sitemap: {site.sitemapUrl}</p> : null}
              </li>
            ))}
          </ul>
        )}
        <p>Private workspace slug: {context.workspace.slug}</p>
        <SignOutButton />
      </section>
    </main>
  );
}
