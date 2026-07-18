import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const nextCli = require.resolve('next/dist/bin/next');
const envFilePath = fileURLToPath(new URL('../../../.env', import.meta.url));
const nextArgs = process.argv.slice(2);

if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envFilePath);
}

if (nextArgs[0] === 'build') {
  process.env.NODE_ENV = 'production';
}

const result = spawnSync(process.execPath, [nextCli, ...nextArgs], {
  env: process.env,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
