import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

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
