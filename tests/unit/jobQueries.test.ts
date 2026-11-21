import { beforeEach, expect, test, vi } from 'vitest';
import { db, USER_ID } from '../helpers/fakeDb';

vi.mock('@/lib/db/server', () => ({ createServerSupabase: async () => db.client }));

import { getJobList, getNavCounts, getStatusCounts } from '@/lib/db/jobQueries';

const ago = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const ev = (job_id: string, score: number | null) => ({ user_id: USER_ID, job_id, score, ghost_level: 'low', ghost_signals: [], error: null });
const app = (job_id: string, status: string, days = 0) => ({ user_id: USER_ID, job_id, status, status_changed_at: ago(days) });

beforeEach(() => {
  db.reset();
  ['a', 'b', 'c', 'd', 'e'].forEach((id) => db.seedJob({ id, title: id }));
  db.seed('evaluations', [ev('a', 60), ev('b', 90), ev('c', null), ev('d', 70), ev('e', 50)]);
  db.seed('applications', [app('c', 'found'), app('d', 'interested'), app('e', 'applied', 10)]);
});

test('recommended = evaluated jobs with no application or found, best score first, unscored last', async () => {
  expect((await getJobList('recommended')).map((r) => r.job.id)).toEqual(['b', 'a', 'c']);
});
test('active covers interested through interview; all can filter by status', async () => {
  expect((await getJobList('active')).map((r) => r.job.id).sort()).toEqual(['d', 'e']);
  expect((await getJobList('all', 'applied')).map((r) => r.job.id)).toEqual(['e']);
  expect(await getJobList('all')).toHaveLength(3);
});
test('counts per status, tab sizes and stale applied jobs', async () => {
  expect((await getStatusCounts()).applied).toBe(1);
  expect(await getNavCounts()).toMatchObject({ recommended: 3, all: 3, stale: 1 });
});
test('no session reads as empty', async () => {
  db.signOut();
  expect(await getJobList('all')).toEqual([]);
  expect((await getNavCounts()).all).toBe(0);
});
