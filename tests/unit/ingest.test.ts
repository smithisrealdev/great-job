import { beforeEach, expect, test, vi } from 'vitest';

const { parseJobPosting, evaluateJob, consumeQuota, fetchOne } = vi.hoisted(() => ({
  parseJobPosting: vi.fn(), evaluateJob: vi.fn(), consumeQuota: vi.fn(), fetchOne: vi.fn(),
}));
vi.mock('@/lib/ai/parseJob', () => ({ parseJobPosting }));
vi.mock('@/lib/ai/evaluate', () => ({ evaluateJob }));
vi.mock('@/lib/db/quota', () => ({ consumeQuota }));
vi.mock('next-intl/server', () => ({ getLocale: async () => 'en' }));
vi.mock('@/lib/sources', async (orig) => ({ ...(await orig<typeof import('@/lib/sources')>()), fetchOne }));
vi.mock('@/lib/db/server', async () => {
  const { db } = await import('../helpers/fakeDb');
  return { createServerSupabase: async () => db.client };
});
vi.mock('@/lib/db/admin', async () => {
  const { db } = await import('../helpers/fakeDb');
  return { createAdminSupabase: () => db.client };
});

import { db, USER_ID } from '../helpers/fakeDb';
import { AiError } from '@/lib/ai/client';
import { ghostLevel } from '@/lib/core/ghost';
import { fingerprint } from '@/lib/core/fingerprint';
import { addJobFromText, addJobFromUrl } from '@/lib/actions/jobs';
import { evaluateForUser, upsertJob } from '@/lib/db/ingest';
import { fetchJson, postingId } from '@/lib/sources';

const validParsedJob = {
  title: 'Senior Backend Engineer', companyName: 'Lumen Pay', location: 'Bangkok', remote: false, salaryText: null,
  skills: ['ts'], description: 'Build things', postedAt: null, vagueDescription: false, evergreen: false,
};
const resume = { skills: ['ts'], experience: [], education: [], yearsTotal: 3 };
const rawGh = {
  source: 'greenhouse' as const, externalId: '123', url: 'https://boards.greenhouse.io/acme/jobs/123', title: 'Backend Engineer',
  companyName: 'Acme', location: null, remote: true, salaryText: null, description: 'd', postedAt: null,
};

beforeEach(() => {
  db.reset();
  db.seed('profiles', [{ user_id: USER_ID, profile_version: 3, prefs: { roles: ['backend'] }, resume }]);
  db.seedJob({ id: 'j1', source: 'paste', external_id: 'e1', owner_id: USER_ID, title: 'T', company_name: 'C', description: 'd', skills: [] });
  parseJobPosting.mockReset().mockResolvedValue(validParsedJob);
  evaluateJob.mockReset().mockResolvedValue({ score: 74, matches: ['ts'], gaps: [], notes: [] });
  consumeQuota.mockReset().mockResolvedValue(true);
  fetchOne.mockReset().mockResolvedValue(null);
  vi.stubGlobal('fetch', vi.fn());
});

test('empty or whitespace text is refused without calling AI', async () => {
  expect(await addJobFromText('   ')).toEqual({ ok: false, reason: 'empty' });
  expect(parseJobPosting).not.toHaveBeenCalled();
});
test('text is truncated to 30000 characters before parsing', async () => {
  await addJobFromText('x'.repeat(50_000));
  expect(parseJobPosting.mock.calls[0][0]).toHaveLength(30_000);
});
test('non-posting text creates no job', async () => {
  parseJobPosting.mockRejectedValue(new AiError('not_a_job'));
  expect(await addJobFromText('สูตรแกงเขียวหวาน')).toEqual({ ok: false, reason: 'not_a_job' });
  expect(db.inserts('jobs')).toEqual([]);
});
test('other parse failures return ai_failed', async () => {
  parseJobPosting.mockRejectedValue(new AiError('timeout'));
  expect(await addJobFromText('Senior Backend Engineer')).toEqual({ ok: false, reason: 'ai_failed' });
});
test.each(['https://th.jobsdb.com/job/1', 'https://www.linkedin.com/jobs/view/1', 'https://example.com/careers'])
  ('%s is refused and never fetched', async (u) => {
    expect(await addJobFromUrl(u)).toEqual({ ok: false, reason: 'unsupported_url' });
    expect(fetch).not.toHaveBeenCalled();
    expect(fetchOne).not.toHaveBeenCalled();
  });
test('pasted job is private to the user, gets source paste, an interested application and an evaluation', async () => {
  const r = await addJobFromText('Senior Backend Engineer at Lumen Pay ...');
  expect(r).toMatchObject({ ok: true });
  expect(db.inserts('jobs')[0]).toMatchObject({
    owner_id: USER_ID, source: 'paste', external_id: `${fingerprint('Lumen Pay', 'Senior Backend Engineer')}:${USER_ID}`,
  });
  expect(db.upserts('applications')[0]).toMatchObject({ user_id: USER_ID, status: 'interested' });
  expect(db.upserts('evaluations')[0]).toMatchObject({ score: 74, error: null, profile_version: 3 });
});
test('the AI is given only job fields, never row ids', async () => {
  await addJobFromText('Senior Backend Engineer at Lumen Pay ...');
  expect(Object.keys(evaluateJob.mock.calls[0][2]).sort()).toEqual(
    ['companyName', 'description', 'evergreen', 'location', 'postedAt', 'remote', 'salaryText', 'skills', 'title', 'vagueDescription'].sort());
});
test('a bad posted date from the AI is stored as null instead of failing the insert', async () => {
  parseJobPosting.mockResolvedValue({ ...validParsedJob, postedAt: 'last Tuesday' });
  await addJobFromText('Senior Backend Engineer at Lumen Pay ...');
  expect(db.inserts('jobs')[0]).toMatchObject({ posted_at: null });
});
test('adding a URL already ingested by cron reuses that row', async () => {
  db.seedJob({ id: 'g1', source: 'greenhouse', external_id: '123', owner_id: null });
  const r = await addJobFromUrl('https://boards.greenhouse.io/acme/jobs/123');
  expect(r).toEqual({ ok: true, jobId: 'g1' });
  expect(db.inserts('jobs')).toEqual([]);
  expect(db.updates('jobs')[0]).toHaveProperty('last_seen_at');
  expect(fetchOne).not.toHaveBeenCalled();
});
test('a new supported URL is fetched and stored as a shared row', async () => {
  fetchOne.mockResolvedValue(rawGh);
  const r = await addJobFromUrl('https://boards.greenhouse.io/acme/jobs/123');
  expect(r).toMatchObject({ ok: true });
  expect(fetchOne).toHaveBeenCalledWith('greenhouse', 'acme', 'https://boards.greenhouse.io/acme/jobs/123');
  expect(db.inserts('jobs')[0]).toMatchObject({ owner_id: null, source: 'greenhouse', external_id: '123' });
});
test('a supported URL that cannot be fetched reports fetch_failed', async () => {
  expect(await addJobFromUrl('https://boards.greenhouse.io/acme/jobs/123')).toEqual({ ok: false, reason: 'fetch_failed' });
  fetchOne.mockRejectedValue(new Error('boom'));
  expect(await addJobFromUrl('https://boards.greenhouse.io/acme/jobs/123')).toEqual({ ok: false, reason: 'fetch_failed' });
});
test('upsertJob records one sighting per day with the job host as domain', async () => {
  await upsertJob(rawGh, null, null);
  expect(db.upserts('job_sightings')[0]).toEqual({
    fingerprint: fingerprint('Acme', 'Backend Engineer'), source_domain: 'boards.greenhouse.io', seen_on: new Date().toISOString().slice(0, 10),
  });
});
test('upsertJob on an existing (source, external_id) only refreshes last_seen_at', async () => {
  db.seedJob({ id: 'g1', source: 'greenhouse', external_id: '123' });
  expect(await upsertJob(rawGh, null, null)).toEqual({ id: 'g1', created: false });
  expect(db.inserts('jobs')).toEqual([]);
});

test('AI failure keeps the job and records an unscored evaluation', async () => {
  evaluateJob.mockRejectedValue(new AiError('timeout'));
  expect(await evaluateForUser('j1', 'evaluate_manual')).toBe('failed');
  expect(db.upserts('evaluations')[0]).toMatchObject({ job_id: 'j1', score: null, error: 'timeout' });
  expect(db.count('jobs')).toBe(1);
});
test('quota exhausted records nothing and reports quota', async () => {
  consumeQuota.mockResolvedValue(false);
  expect(await evaluateForUser('j1', 'evaluate_manual')).toBe('quota');
  expect(evaluateJob).not.toHaveBeenCalled();
  expect(db.upserts('evaluations')).toEqual([]);
});
test('no résumé: no AI call, failed with no_resume', async () => {
  db.seed('profiles', [{ user_id: USER_ID, profile_version: 1, prefs: {}, resume: null }]);
  expect(await evaluateForUser('j1', 'evaluate_manual')).toBe('failed');
  expect(evaluateJob).not.toHaveBeenCalled();
  expect(db.upserts('evaluations')[0]).toMatchObject({ score: null, error: 'no_resume' });
});
test('evaluation stores ghost level together with its signals', async () => {
  db.seed('jobs', []);
  db.seedJob({ id: 'j1', owner_id: USER_ID, posted_at: '2020-01-01', vague_description: true, title: 'T', description: 'd' });
  expect(await evaluateForUser('j1', 'evaluate_manual')).toBe('done');
  const e = db.upserts('evaluations')[0] as { ghost_signals: never[]; ghost_level: string };
  expect(e.ghost_signals.length).toBeGreaterThan(0);
  expect(e.ghost_level).toBe(ghostLevel(e.ghost_signals));
});
test('a failed evaluation still stores the ghost signals, which need no AI', async () => {
  db.seed('jobs', []);
  db.seedJob({ id: 'j1', owner_id: USER_ID, posted_at: '2020-01-01', title: 'T', description: 'd' });
  evaluateJob.mockRejectedValue(new AiError('invalid_output'));
  await evaluateForUser('j1', 'evaluate_auto');
  expect(db.upserts('evaluations')[0]).toMatchObject({ error: 'invalid_output', ghost_level: 'mid', ghost_signals: ['age_60'] });
  expect(consumeQuota).toHaveBeenCalledWith('evaluate_auto');
});
test('repost signal: the same fingerprint seen two weeks apart counts as reposted', async () => {
  const fp = fingerprint('C', 'T');
  db.seed('job_sightings', [
    { fingerprint: fp, source_domain: 'a', seen_on: '2026-01-01' }, { fingerprint: fp, source_domain: 'a', seen_on: '2026-01-05' },
    { fingerprint: fp, source_domain: 'b', seen_on: '2026-02-01' },
  ]);
  await evaluateForUser('j1', 'evaluate_manual');
  expect(db.upserts('evaluations')[0]).toMatchObject({ ghost_signals: ['reposted'] });
});
test('a pasted job missing from the company board gets missing_from_careers', async () => {
  db.seed('companies', [{ id: 'c1', name: 'Acme Inc.' }]);
  db.seed('jobs', [{ id: 'j1', owner_id: USER_ID, source: 'paste', title: 'Backend Engineer', company_name: 'acme inc', description: 'd', skills: [] },
    { id: 'b1', owner_id: null, source: 'greenhouse', company_id: 'c1', fingerprint: fingerprint('x', 'Other role') }]);
  await evaluateForUser('j1', 'evaluate_manual');
  expect(db.upserts('evaluations')[0]).toMatchObject({ ghost_signals: ['missing_from_careers'] });
});

test('postingId reads the posting id from each ATS url', () => {
  expect(postingId('greenhouse', 'https://boards.greenhouse.io/acme/jobs/123')).toBe('123');
  expect(postingId('lever', 'https://jobs.lever.co/acme/2a55d6c9-c564-443a-be3e-a3851db5a93b/apply')).toBe('2a55d6c9-c564-443a-be3e-a3851db5a93b');
  expect(postingId('ashby', 'https://jobs.ashbyhq.com/acme/7458d4e9-da2e-47bd-98cb-adfda43d42b2')).toBe('7458d4e9-da2e-47bd-98cb-adfda43d42b2');
  expect(postingId('greenhouse', 'https://boards.greenhouse.io/acme')).toBeNull();
  expect(postingId('greenhouse', 'https://boards.greenhouse.io/acme/jobs/abc')).toBeNull();
});
test('fetchJson refuses hosts outside the allowlist without a request', async () => {
  await expect(fetchJson('https://evil.example.com/x')).rejects.toThrow();
  await expect(fetchJson('https://api.lever.co.evil.com/x')).rejects.toThrow();
  await expect(fetchJson('http://api.lever.co/v0/postings/a')).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
