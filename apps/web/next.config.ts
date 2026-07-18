import type { NextConfig } from 'next';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(join(root, '.env'));
}

const nextConfig: NextConfig = {
  turbopack: {
    root,
  },
  transpilePackages: [
    '@site-quality-audit/config',
    '@site-quality-audit/domain',
  ],
};

export default nextConfig;
