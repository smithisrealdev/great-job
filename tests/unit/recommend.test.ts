import { beforeEach, expect, test, vi } from 'vitest';

const { evaluateForUser, parseJobPosting, consumeQuota } = vi.hoisted(() => ({ evaluateForUser: vi.fn(), parseJobPosting: vi.fn(), consumeQuota: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/ingest', () => ({ evaluateForUser }));
vi.mock('@/lib/ai/parseJob', () => ({ parseJobPosting }));
vi.mock('@/lib/db/quota', () => ({ consumeQuota }));
vi.mock('@/lib/db/server', async () => {
  const { db } = await import('../helpers/fakeDb');
  return { createServerSupabase: async () => db.client };
});
vi.mock('@/lib/db/admin', async () => {
  const { db } = await import('../helpers/fakeDb');
  return { createAdminSupabase: () => db.client };
});

import { db, USER_ID } from '../helpers/fakeDb';
import { pickNextCandidate } from '@/lib/db/recommend';
import { POST } from '@/app/api/evaluate-next/route';
import { runRecommendLoop, type NextResult } from '@/lib/recommendLoop';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const resume = { skills: ['ts'], experience: [], education: [], yearsTotal: 3 };
const job = (id: string, over: Record<string, unknown> = {}) => db.seedJob({ id, title: 'Backend Engineer', remote: true, first_seen_at: daysAgo(1), ...over });
const evaluated = (job_id: string, over: Record<string, unknown> = {}) => db.seed('evaluations', [...(db.rows('evaluations')), { user_id: USER_ID, job_id, score: 80, error: null, profile_version: 1, ...over }]);

beforeEach(() => {
  db.reset();
  vi.resetAllMocks();
  db.seed('profiles', [{ user_id: USER_ID, profile_version: 1, prefs: { roles: ['backend'], modes: ['remote'] }, resume }]);
});

test('picks a shared job from the last 14 days that passes the prefilter and has no evaluation', async () => {
  job('old', { first_seen_at: daysAgo(30) });
  job('sale', { title: 'Account Executive', first_seen_at: daysAgo(1) });
  job('done');
  job('private', { owner_id: 'someone', first_seen_at: daysAgo(0) });
  job('good', { first_seen_at: daysAgo(2) });
  evaluated('done');
  expect(await pickNextCandidate(USER_ID)).toBe('good');
});

test('newest job first', async () => {
  job('a', { first_seen_at: daysAgo(5) });
  job('b', { first_seen_at: daysAgo(1) });
  expect(await pickNextCandidate(USER_ID)).toBe('b');
});

test('returns null when nothing is left', async () => {
  expect(await pickNextCandidate(USER_ID)).toBeNull();
});

test('returns null without a resume or prefs', async () => {
  job('good');
  db.seed('profiles', [{ user_id: USER_ID, profile_version: 1, prefs: null, resume: null }]);
  expect(await pickNextCandidate(USER_ID)).toBeNull();
});

test('a stale evaluation from an older profile_version is picked again', async () => {
  job('j');
  evaluated('j', { profile_version: 1 });
  db.seed('profiles', [{ user_id: USER_ID, profile_version: 2, prefs: { roles: ['backend'], modes: ['remote'] }, resume }]);
  expect(await pickNextCandidate(USER_ID)).toBe('j');
});

test('a job that failed is not offered again', async () => {
  job('bad');
  evaluated('bad', { score: null, error: 'timeout' });
  expect(await pickNextCandidate(USER_ID)).toBeNull();
});

test('route is 401 without a session and does no work', async () => {
  db.signOut();
  expect((await POST()).status).toBe(401);
  expect(evaluateForUser).not.toHaveBeenCalled();
});

test('route reports none when there is no candidate', async () => {
  expect(await (await POST()).json()).toEqual({ status: 'none' });
});

test('route reports quota without evaluating once the auto limit is used', async () => {
  job('j', { skills: ['ts'] });
  evaluateForUser.mockResolvedValue('quota');
  expect(await (await POST()).json()).toEqual({ status: 'quota' });
  expect(evaluateForUser).toHaveBeenCalledWith('j', 'evaluate_auto');
});

test('route maps done and failed results', async () => {
  job('j', { skills: ['ts'] });
  evaluateForUser.mockResolvedValueOnce('done').mockResolvedValueOnce('failed');
  expect(await (await POST()).json()).toEqual({ status: 'done', jobId: 'j' });
  expect(await (await POST()).json()).toEqual({ status: 'failed', jobId: 'j' });
});

test('route parses a job with empty skills once and stores only the three columns; a parse failure does not stop scoring', async () => {
  job('j', { description: 'text', skills: [] });
  consumeQuota.mockResolvedValue(true);
  parseJobPosting.mockResolvedValue({ skills: ['go'], vagueDescription: true, evergreen: false });
  evaluateForUser.mockResolvedValue('done');
  await POST();
  expect(db.updates('jobs')).toEqual([{ skills: ['go'], vague_description: true, evergreen: false }]);
  db.reset(); db.seed('profiles', [{ user_id: USER_ID, profile_version: 1, prefs: { roles: ['backend'], modes: ['remote'] }, resume }]);
  job('k', { description: 'text', skills: [] });
  const { AiError } = await import('@/lib/ai/client');
  parseJobPosting.mockRejectedValue(new AiError('timeout'));
  expect(await (await POST()).json()).toEqual({ status: 'done', jobId: 'k' });
});

const feed = (...rs: NextResult[]) => { const q = [...rs]; return vi.fn(async () => q.shift() ?? ({ status: 'none' } as NextResult)); };
const d: NextResult = { status: 'done', jobId: 'x' };

test('loop stops on none and counts only done', async () => {
  const next = feed(d, { status: 'failed', jobId: 'y' }, d, { status: 'none' });
  expect(await runRecommendLoop(next, { max: 20, signal: new AbortController().signal })).toEqual({ done: 2, end: 'none' });
});
test('loop stops on quota', async () => {
  expect(await runRecommendLoop(feed(d, { status: 'quota' }), { max: 20, signal: new AbortController().signal })).toEqual({ done: 1, end: 'quota' });
});
test('loop stops at max', async () => {
  const next = vi.fn(async () => d);
  expect(await runRecommendLoop(next, { max: 3, signal: new AbortController().signal })).toEqual({ done: 3, end: 'max' });
  expect(next).toHaveBeenCalledTimes(3);
});
test('loop stops when aborted and reports progress', async () => {
  const ac = new AbortController();
  const seen: number[] = [];
  const r = await runRecommendLoop(async () => d, { max: 20, signal: ac.signal, onProgress: (n) => { seen.push(n); if (n === 2) ac.abort(); } });
  expect(r).toEqual({ done: 2, end: 'aborted' });
  expect(seen).toEqual([1, 2]);
});
test('loop stops on a failing call', async () => {
  expect(await runRecommendLoop(async () => { throw new Error('500'); }, { max: 20, signal: new AbortController().signal })).toEqual({ done: 0, end: 'error' });
});
