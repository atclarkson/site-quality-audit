import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const prismaCli = require.resolve('prisma/build/index.js');
const envFilePath = fileURLToPath(new URL('../../../.env', import.meta.url));

if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envFilePath);
}

const result = spawnSync(
  process.execPath,
  [prismaCli, ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: process.env,
  },
);

process.exit(result.status ?? 1);
