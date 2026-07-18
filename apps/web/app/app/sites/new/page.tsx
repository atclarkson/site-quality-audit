import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createEmptySiteFormState } from '../../../../lib/site-management';
import { getAuthorizedAppContext } from '../../../../lib/authorized-app-context';
import { createCreateSiteAction } from '../../../../lib/site-actions';
import { SiteForm } from '../site-form';

export default async function NewSitePage() {
  const context = await getAuthorizedAppContext();

  if (!context) {
    redirect('/');
  }

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
          action={createCreateSiteAction()}
          cancelHref="/app"
          initialState={createEmptySiteFormState()}
          submitLabel="Create site"
        />
      </section>
    </main>
  );
}
