import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  dts: true,
  outDir: 'dist',
  clean: true,
  noExternal: [/^@site-quality-audit\//],
});
