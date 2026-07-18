import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthorizedAppContext } from '../../../../../lib/authorized-app-context';
import {
  getSiteForWorkspace,
  toSiteFormState,
} from '../../../../../lib/site-management';
import { createUpdateSiteAction } from '../../../../../lib/site-actions';
import { SiteForm } from '../../site-form';

export default async function EditSitePage({
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

  return (
    <main>
      <section>
        <p>
          <Link href={`/app/sites/${siteId}`}>Back to site</Link>
        </p>
        <h1>Edit {site.name}</h1>
        <SiteForm
          action={createUpdateSiteAction(siteId)}
          cancelHref={`/app/sites/${siteId}`}
          initialState={toSiteFormState({
            name: site.name,
            primaryUrl: site.primaryUrl,
            sitemapUrl: site.sitemapUrl || '',
          })}
          submitLabel="Save changes"
        />
      </section>
    </main>
  );
}
