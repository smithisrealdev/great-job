import { beforeEach, expect, test, vi } from 'vitest';

const { evaluateForUser } = vi.hoisted(() => ({ evaluateForUser: vi.fn() }));
vi.mock('@/lib/db/ingest', () => ({ evaluateForUser, reuseSharedJob: vi.fn(), upsertJob: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/db/server', async () => {
  const { db } = await import('../helpers/fakeDb');
  return { createServerSupabase: async () => db.client };
});

import { db, USER_ID } from '../helpers/fakeDb';
import { retryEvaluation, setStatus } from '@/lib/actions/jobs';
import type { Status } from '@/lib/types';

beforeEach(() => { db.reset(); evaluateForUser.mockReset(); db.seedJob({ id: 'j1' }); db.seedJob({ id: 'j2' }); });

test('setStatus upserts the application with a fresh status_changed_at', async () => {
  expect(await setStatus('j1', 'applied')).toEqual({ ok: true });
  expect(db.upserts('applications')[0]).toMatchObject({ user_id: USER_ID, job_id: 'j1', status: 'applied' });
  expect(db.upserts('applications')[0].status_changed_at).toBeTruthy();
});
test('setStatus rejects a value outside the Status union', async () => {
  expect(await setStatus('j1', 'hired' as Status)).toEqual({ ok: false, reason: 'invalid' });
  expect(db.upserts('applications')).toEqual([]);
});
test('setStatus on a job the user cannot see changes nothing', async () => {
  db.hideJob('j2');
  expect(await setStatus('j2', 'applied')).toEqual({ ok: false, reason: 'not_found' });
  expect(db.upserts('applications')).toEqual([]);
});
test('setStatus reports a failed write', async () => {
  db.failNext('applications', { message: 'boom' });
  expect(await setStatus('j1', 'applied')).toEqual({ ok: false, reason: 'db_failed' });
});
test('retryEvaluation runs a manual evaluation and returns its outcome', async () => {
  evaluateForUser.mockResolvedValue('quota');
  expect(await retryEvaluation('j1')).toBe('quota');
  expect(evaluateForUser).toHaveBeenCalledWith('j1', 'evaluate_manual');
});
