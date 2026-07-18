import Link from 'next/link';
import { auth } from '../auth';
import { APP_NAME } from '@site-quality-audit/domain';
import { SignInButton } from './sign-in-button';

export default async function HomePage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);

  return (
    <main>
      <section>
        <h1>{APP_NAME}</h1>
        <p>
          Assess the technical, editorial, and strategic quality of content
          websites.
        </p>
        {signedIn ? (
          <>
            <p>Signed in as {session?.user?.name || session?.user?.email}</p>
            <p>
              <Link href="/app">Open the authenticated app</Link>
            </p>
          </>
        ) : (
          <>
            <p>Sign in to access your private workspace.</p>
            <SignInButton />
          </>
        )}
      </section>
    </main>
  );
}
