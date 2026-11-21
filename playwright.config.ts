import { defineConfig } from '@playwright/test';

// Needs a local Supabase (`npx supabase start`, then `npx supabase db reset`) with NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY / SUPABASE_SERVICE_ROLE_KEY in .env.local.
// The app runs under `next dev` because AI_FAKE is ignored in production builds.
export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/th/login',
    env: { AI_FAKE: '1', NEXT_PUBLIC_E2E: '1' },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
