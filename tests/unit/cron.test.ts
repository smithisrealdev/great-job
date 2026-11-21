import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('@/lib/db/server', async () => {
  const { db } = await import('../helpers/fakeDb');
  return { createServerSupabase: async () => db.client };
});
vi.mock('@/lib/db/admin', async () => {
  const { db } = await import('../helpers/fakeDb');
  return { createAdminSupabase: () => db.client };
});

import { GET } from '@/app/api/cron/daily/route';
import { runDailyIngest } from '@/lib/sources/daily';
import { db } from '../helpers/fakeDb';
import { fixture, mockFetch } from '../helpers/fixtures';

beforeEach(() => { db.reset(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

test('a 404 board is reported and the other boards still run', async () => {
  db.seed('companies', [{ id: 'c1', name: 'Gone', ats: 'greenhouse', board_token: 'gone' }, { id: 'c2', name: 'Ok Inc', ats: 'lever', board_token: 'ok' }]);
  mockFetch({ '/gone/': 404, '/postings/ok': fixture('lever'), 'remoteok.com': 404 });
  const r = await runDailyIngest();
  expect(r.errors).toEqual([expect.objectContaining({ source: 'greenhouse:gone' }), expect.objectContaining({ source: 'remoteok' })]);
  expect(r.boards).toBe(1);
  expect(r.jobs).toBeGreaterThan(0);
  expect(db.deletes('jobs')).toEqual([]);
  expect(db.inserts('jobs')[0]).toMatchObject({ owner_id: null, company_id: 'c2', company_name: 'Ok Inc', source: 'lever' });
});

test('running twice creates no duplicates and refreshes last_seen_at', async () => {
  db.seed('companies', [{ id: 'c2', name: 'Ok Inc', ats: 'lever', board_token: 'ok' }]);
  mockFetch({ '/postings/ok': fixture('lever'), 'remoteok.com': fixture('remoteok') });
  await runDailyIngest();
  const n = db.count('jobs');
  expect(n).toBe(6);
  await runDailyIngest();
  expect(db.count('jobs')).toBe(n);
  expect(db.updates('jobs').length).toBe(n);
  expect(db.updates('jobs')[0]).toHaveProperty('last_seen_at');
});

test('cron route refuses a request without the secret', async () => {
  vi.stubEnv('CRON_SECRET', 's3cret');
  expect((await GET(new Request('http://x/api/cron/daily'))).status).toBe(401);
  expect((await GET(new Request('http://x/api/cron/daily', { headers: { authorization: 'Bearer nope' } }))).status).toBe(401);
});

test('cron route answers 401 when CRON_SECRET is unset, even for "Bearer undefined"', async () => {
  vi.stubEnv('CRON_SECRET', '');
  expect((await GET(new Request('http://x/api/cron/daily', { headers: { authorization: 'Bearer undefined' } }))).status).toBe(401);
});

test('cron route runs the ingest with the right secret', async () => {
  vi.stubEnv('CRON_SECRET', 's3cret');
  mockFetch({});
  const res = await GET(new Request('http://x/api/cron/daily', { headers: { authorization: 'Bearer s3cret' } }));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ boards: 0, jobs: 0 });
});

test('a failed companies read is reported, not a silent empty run', async () => {
  vi.spyOn(db.client, 'from').mockImplementationOnce(() => ({ select: async () => ({ data: null, error: { message: 'db down' } }) }) as never);
  mockFetch({ 'remoteok.com': fixture('remoteok') });
  const r = await runDailyIngest();
  expect(r.errors).toContainEqual({ source: 'companies', message: 'db down' });
  expect(console.error).toHaveBeenCalledWith(expect.stringContaining('db down'));
});
