import Link from 'next/link';
import { redirect } from 'next/navigation';
import { APP_NAME } from '@site-quality-audit/domain';
import { getAuthorizedAppContext } from '../../lib/authorized-app-context';
import { SignOutButton } from '../sign-out-button';

export default async function AppPage() {
  const context = await getAuthorizedAppContext();

  if (!context) {
    redirect('/');
  }

  return (
    <main>
      <section>
        <p>{APP_NAME}</p>
        <h1>{context.workspace.name}</h1>
        <p>Signed in as {context.user.name || context.user.email}</p>
        <p>Role: {context.role}</p>
        <p>
          This is the minimal authenticated shell. Site management and audit
          features come later.
        </p>
        <p>
          <Link href="/">Back to home</Link>
        </p>
        <SignOutButton />
      </section>
    </main>
  );
}
