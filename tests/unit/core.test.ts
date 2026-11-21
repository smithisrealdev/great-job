import { test, expect } from 'vitest';
import { fingerprint } from '@/lib/core/fingerprint';
import { detectAts } from '@/lib/core/ats';
import { prefilter } from '@/lib/core/prefilter';
import { ghostSignals, ghostLevel } from '@/lib/core/ghost';
import { moodForStatus, moodForJob } from '@/lib/core/mood';
import type { Prefs } from '@/lib/types';

test('fingerprint ignores case, spacing and punctuation', () => {
  expect(fingerprint('Baan Cloud ', 'Full-Stack  Developer')).toBe(fingerprint('baan cloud', 'full stack developer'));
  expect(fingerprint('Baan Cloud', 'Backend Developer')).not.toBe(fingerprint('Baan Cloud', 'Full-stack Developer'));
});
test.each([
  ['https://boards.greenhouse.io/acme/jobs/123', { ats: 'greenhouse', token: 'acme' }],
  ['https://job-boards.greenhouse.io/acme', { ats: 'greenhouse', token: 'acme' }],
  ['https://jobs.lever.co/acme/abc-123', { ats: 'lever', token: 'acme' }],
  ['https://jobs.ashbyhq.com/acme', { ats: 'ashby', token: 'acme' }],
])('detectAts %s', (u, want) => expect(detectAts(u)).toEqual(want));
test.each(['https://th.jobsdb.com/job/1', 'https://www.linkedin.com/jobs/view/1', 'https://www.jobthai.com/x', 'not a url', 'http://boards.greenhouse.io.evil.com/acme',
  'http://boards.greenhouse.io/acme', 'https://boards.greenhouse.io@evil.com/x', 'https://boards.greenhouse.io/', 'https://jobs.lever.co/a%2F..%2Fb', 'https://boards.greenhouse.io:8443/acme'])
  ('detectAts refuses %s', (u) => expect(detectAts(u)).toBeNull());

const prefs: Prefs = { roles: ['backend','full-stack'], modes: ['remote'], minSalaryThb: null, seniority: null };
test('prefilter keeps matching role and mode', () => {
  expect(prefilter({ title: 'Senior Backend Engineer', remote: true, location: null }, prefs)).toBe(true);
  expect(prefilter({ title: 'Account Executive', remote: true, location: null }, prefs)).toBe(false);
  expect(prefilter({ title: 'Backend Engineer', remote: false, location: 'Berlin' }, prefs)).toBe(false);
  expect(prefilter({ title: 'Backend Engineer', remote: false, location: 'Bangkok' }, { ...prefs, modes: ['thailand'] })).toBe(true);
});

const now = new Date('2026-11-21');
const base = { now, sightingDays: 1, onCareersPage: null, vagueDescription: false, evergreen: false };
test('ghost signals and levels', () => {
  expect(ghostLevel(ghostSignals({ ...base, postedAt: '2026-11-17' }))).toBe('low');
  expect(ghostSignals({ ...base, postedAt: '2026-10-14' })).toEqual(['age_30']);
  expect(ghostLevel(['age_30'])).toBe('mid');
  const s = ghostSignals({ now, postedAt: '2026-08-21', sightingDays: 3, onCareersPage: false, vagueDescription: true, evergreen: false });
  expect(s).toEqual(['age_60','reposted','missing_from_careers','vague_description']);
  expect(ghostLevel(s)).toBe('high');
  expect(ghostSignals({ ...base, postedAt: null })).toEqual([]);
});
test('moods', () => {
  expect(moodForStatus('interview')).toBe('celebrate');
  expect(moodForStatus('offer')).toBe('celebrate');
  expect(moodForStatus('rejected')).toBe('cheer');
  expect(moodForStatus('applied')).toBe('wave');
  expect(moodForStatus('preparing')).toBe('thinking');
  expect(moodForStatus('interested')).toBe('happy');
  expect(moodForStatus('found')).toBe('idle');
  expect(moodForStatus('withdrawn')).toBe('idle');
  expect(moodForJob(88, 'low')).toBe('happy');
  expect(moodForJob(88, 'high')).toBe('spooked');
  expect(moodForJob(null, null)).toBe('thinking');
  expect(moodForJob(50, 'low')).toBe('idle');
});
