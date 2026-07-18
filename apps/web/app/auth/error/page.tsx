import Link from 'next/link';
import { APP_NAME } from '@site-quality-audit/domain';

const authErrorMessages: Record<string, string> = {
  AccessDenied: 'Access was denied during sign-in.',
  Configuration: 'Authentication is not configured correctly.',
  Verification: 'The sign-in request could not be verified.',
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? authErrorMessages[error] : null;

  return (
    <main>
      <section>
        <p>{APP_NAME}</p>
        <h1>Authentication Error</h1>
        <p>{message || 'Sign-in could not be completed safely.'}</p>
        <p>
          <Link href="/">Return home</Link>
        </p>
      </section>
    </main>
  );
}
