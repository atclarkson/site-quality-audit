import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  createSiteForWorkspace,
  createEmptySiteFormState,
  siteValuesFromFormData,
  toSiteFormErrorState,
  type SiteFormState,
} from '../../../../lib/site-management';
import { getAuthorizedAppContext } from '../../../../lib/authorized-app-context';
import { SiteForm } from '../site-form';

export default async function NewSitePage() {
  const context = await getAuthorizedAppContext();

  if (!context) {
    redirect('/');
  }

  const createSiteAction = async (
    _previousState: SiteFormState,
    formData: FormData,
  ) => {
    'use server';

    const values = siteValuesFromFormData(formData);

    try {
      const site = await createSiteForWorkspace(context, values);
      redirect(`/app/sites/${site.id}`);
    } catch (error) {
      return toSiteFormErrorState(error, values);
    }
  };

  return (
    <main>
      <section>
        <p>
          <Link href="/app">Back to workspace</Link>
        </p>
        <h1>Add a site</h1>
        <p>
          Register a primary site URL and optional sitemap for this workspace.
        </p>
        <SiteForm
          action={createSiteAction}
          cancelHref="/app"
          initialState={createEmptySiteFormState()}
          submitLabel="Create site"
        />
      </section>
    </main>
  );
}
