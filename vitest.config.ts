import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)), 'server-only': fileURLToPath(new URL('./tests/emptyModule.ts', import.meta.url)) } },
  test: { environment: 'jsdom', exclude: ['tests/e2e/**', 'node_modules/**'], include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/db/**/*.test.ts'] },
});
