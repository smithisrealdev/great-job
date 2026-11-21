import { afterEach, expect, test } from 'vitest';
import { vi } from 'vitest';
import { fetchBoard, fetchJson, fetchRemoteOk } from '@/lib/sources';
import { fixture, mockFetch } from '../helpers/fixtures';

afterEach(() => vi.unstubAllGlobals());

test.each(['greenhouse', 'lever', 'ashby'] as const)('%s fixture maps to complete RawJobs', async (ats) => {
  mockFetch({ '': fixture(ats) });
  const jobs = await fetchBoard(ats, 'acme');
  expect(jobs).toHaveLength(3);
  for (const j of jobs) {
    expect(j.source).toBe(ats);
    expect(j.externalId).toBeTruthy();
    expect(j.title).toBeTruthy();
    expect(j.url).toMatch(/^https:\/\//);
    expect(j.description.length).toBeGreaterThan(50);
    expect(j.description).not.toMatch(/<[a-z]+[ >]/i); // HTML stripped
  }
});

test('remoteok skips the legal notice row', async () => {
  mockFetch({ '': fixture('remoteok') });
  const jobs = await fetchRemoteOk();
  expect(jobs.every((j) => j.source === 'remoteok' && j.url.startsWith('https://remoteok.com/'))).toBe(true);
  expect(jobs.length).toBe(fixture('remoteok').length - 1);
});

test('a job without title, id or an https url is skipped, not an error', async () => {
  const [a, b, c] = fixture('lever');
  mockFetch({ '': [a, { ...b, text: '' }, { ...c, hostedUrl: 'http://insecure.example/x' }, { ...a, id: undefined }] });
  expect(await fetchBoard('lever', 'acme')).toHaveLength(1);
});

test('fetch refuses a host outside the allowlist', async () => {
  const stub = mockFetch({});
  await expect(fetchJson('https://th.jobsdb.com/api')).rejects.toThrow(/allowlist/);
  expect(stub).not.toHaveBeenCalled();
});
