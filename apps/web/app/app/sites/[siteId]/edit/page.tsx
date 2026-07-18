import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthorizedAppContext } from '../../../../../lib/authorized-app-context';
import {
  getSiteForWorkspace,
  siteValuesFromFormData,
  toSiteFormErrorState,
  toSiteFormState,
  updateSiteForWorkspace,
  type SiteFormState,
} from '../../../../../lib/site-management';
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

  const updateSiteAction = async (
    _previousState: SiteFormState,
    formData: FormData,
  ) => {
    'use server';

    const values = siteValuesFromFormData(formData);

    try {
      const updatedSite = await updateSiteForWorkspace(context, siteId, values);

      if (!updatedSite) {
        redirect('/app');
      }

      redirect(`/app/sites/${siteId}`);
    } catch (error) {
      return toSiteFormErrorState(error, values);
    }
  };

  return (
    <main>
      <section>
        <p>
          <Link href={`/app/sites/${siteId}`}>Back to site</Link>
        </p>
        <h1>Edit {site.name}</h1>
        <SiteForm
          action={updateSiteAction}
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
