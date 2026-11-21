import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { redirect, signInWithPassword, signInWithOtp } = vi.hoisted(() => ({
  redirect: vi.fn((to: string) => { throw new Error(`redirect:${to}`); }),
  signInWithPassword: vi.fn(async () => ({ error: null })),
  signInWithOtp: vi.fn(async () => ({ error: null })),
}));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: 'app.test', 'x-forwarded-proto': 'https' }) }));
vi.mock('@/lib/db/server', async () => {
  const { db } = await import('../helpers/fakeDb');
  return { createServerSupabase: async () => ({ ...db.client, auth: { ...db.client.auth, signInWithPassword, signInWithOtp } }) };
});

import * as actions from '@/app/[locale]/login/actions';
import { db } from '../helpers/fakeDb';

const form = (o: Record<string, string>) => { const f = new FormData(); Object.entries(o).forEach(([k, v]) => f.set(k, v)); return f; };
const creds = form({ email: 'e2e@x.test', password: 'pw' });

beforeEach(() => { db.reset(); redirect.mockClear(); signInWithPassword.mockClear(); signInWithOtp.mockClear(); });
afterEach(() => vi.unstubAllEnvs());

test('the e2e password sign-in is refused in production even with NEXT_PUBLIC_E2E=1', async () => {
  vi.stubEnv('NEXT_PUBLIC_E2E', '1');
  vi.stubEnv('NODE_ENV', 'production');
  await expect(actions.signInWithPassword('th', creds)).rejects.toThrow('redirect:/th/login?error=1');
  expect(signInWithPassword).not.toHaveBeenCalled();
});
test('the e2e password sign-in lands on the job list outside production', async () => {
  vi.stubEnv('NEXT_PUBLIC_E2E', '1');
  vi.stubEnv('NODE_ENV', 'test');
  await expect(actions.signInWithPassword('en', creds)).rejects.toThrow('redirect:/en/jobs');
});
test('the magic link returns to the job list', async () => {
  await expect(actions.signInWithEmail('th', form({ email: 'a@x.test' }))).rejects.toThrow('redirect:/th/login?sent=1');
  expect(signInWithOtp).toHaveBeenCalledWith(expect.objectContaining({
    options: { emailRedirectTo: `https://app.test/auth/callback?next=${encodeURIComponent('/th/jobs')}` },
  }));
});
test('signOut ends the session and goes to the login page', async () => {
  await expect(actions.signOut('en')).rejects.toThrow('redirect:/en/login');
  expect((await db.client.auth.getUser()).data.user).toBeNull();
});
