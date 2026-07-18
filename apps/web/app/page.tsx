import { getWebEnv } from '@site-quality-audit/config';
import { DATABASE_PROVIDER } from '@site-quality-audit/database/provider';
import { APP_NAME } from '@site-quality-audit/domain';

export default function HomePage() {
  const env = getWebEnv();

  return (
    <main>
      <section>
        <h1>{APP_NAME}</h1>
        <p>Minimal Phase 1 scaffold for the web and worker process boundary.</p>
        <p>Environment: {env.NODE_ENV}</p>
        <p>Database: {DATABASE_PROVIDER}</p>
      </section>
    </main>
  );
}
