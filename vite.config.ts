import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The game ships as one self-contained index.html that runs from file:// with no network.
export default defineConfig({
  base: './',
  plugins: [preact(), viteSingleFile()],
  build: { target: 'es2022', outDir: 'dist', assetsInlineLimit: Number.MAX_SAFE_INTEGER },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 120_000,
    // 2.0.29: LEAGUE_CACHE=1 keeps built leagues on disk between runs (tests/setup/league-cache.ts).
    setupFiles: ['tests/setup/league-cache.ts'],
  },
});
