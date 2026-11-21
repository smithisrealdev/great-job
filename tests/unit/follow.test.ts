import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/db/server', async () => {
  const { db } = await import('../helpers/fakeDb');
  return { createServerSupabase: async () => db.client };
});
vi.mock('@/lib/db/admin', async () => {
  const { db } = await import('../helpers/fakeDb');
  return { createAdminSupabase: () => db.client };
});

import { followCompany } from '@/lib/actions/jobs';
import { db } from '../helpers/fakeDb';
import { fixture, mockFetch } from '../helpers/fixtures';

beforeEach(() => db.reset());
afterEach(() => vi.unstubAllGlobals());

test('follows a board by its careers url, naming the company from its first job', async () => {
  mockFetch({ '/boards/acme/': fixture('greenhouse') });
  expect(await followCompany('https://boards.greenhouse.io/acme')).toEqual({ ok: true });
  expect(db.inserts('companies')).toEqual([{ name: fixture('greenhouse').jobs[0].company_name, ats: 'greenhouse', board_token: 'acme' }]);
});

test('an unsupported url is refused without a request', async () => {
  const stub = mockFetch({});
  expect(await followCompany('https://example.com/careers')).toEqual({ ok: false, reason: 'unsupported_url' });
  expect(stub).not.toHaveBeenCalled();
});

test('a 404 or empty board is board_not_found and nothing is stored', async () => {
  mockFetch({ '/boards/gone/': 404, '/boards/empty/': { jobs: [] } });
  expect(await followCompany('https://boards.greenhouse.io/gone')).toEqual({ ok: false, reason: 'board_not_found' });
  expect(await followCompany('https://boards.greenhouse.io/empty')).toEqual({ ok: false, reason: 'board_not_found' });
  expect(db.inserts('companies')).toEqual([]);
});

test('following an already followed board succeeds', async () => {
  mockFetch({ '/boards/acme/': fixture('greenhouse') });
  db.failNext('companies', { code: '23505', message: 'duplicate' });
  expect(await followCompany('https://boards.greenhouse.io/acme')).toEqual({ ok: true });
});
