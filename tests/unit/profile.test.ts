import { beforeEach, expect, test, vi } from 'vitest';

const { parseResume, consumeQuota } = vi.hoisted(() => ({ parseResume: vi.fn(), consumeQuota: vi.fn() }));
vi.mock('@/lib/ai/parseResume', () => ({ parseResume }));
vi.mock('@/lib/db/quota', () => ({ consumeQuota }));
vi.mock('@/lib/db/server', async () => {
  const { db } = await import('../helpers/fakeDb');
  return { createServerSupabase: async () => db.client };
});

import { db, USER_ID } from '../helpers/fakeDb';
import { AiError } from '@/lib/ai/client';
import { savePrefs, updateResume, uploadResume } from '@/lib/actions/profile';

const sampleResume = { skills: ['ts'], experience: [], education: [], yearsTotal: 3 };
const prefs = { roles: ['backend'], modes: ['remote' as const], minSalaryThb: null, seniority: null };
const formWith = (name: string, type: string, size: number, head = type === 'application/pdf' ? '%PDF-' : 'PK') => {
  const bytes = new Uint8Array(size);
  bytes.set(new TextEncoder().encode(head).slice(0, size));
  const f = new FormData();
  f.set('resume', new File([bytes], name, { type }));
  return f;
};
const validPdfForm = () => formWith('cv.pdf', 'application/pdf', 100);

beforeEach(() => {
  db.reset();
  db.seed('profiles', [{ user_id: USER_ID, profile_version: 1, onboarded_at: null }]);
  parseResume.mockReset();
  consumeQuota.mockReset().mockResolvedValue(true);
});

test('rejects a non-PDF without calling AI', async () => {
  expect(await uploadResume(formWith('cv.docx', 'application/msword', 10))).toEqual({ ok: false, reason: 'not_pdf' });
  expect(parseResume).not.toHaveBeenCalled();
});
test('does not trust the client MIME type: PDF label on non-PDF bytes is rejected', async () => {
  expect(await uploadResume(formWith('cv.pdf', 'application/pdf', 100, 'MZ'))).toEqual({ ok: false, reason: 'not_pdf' });
});
test('rejects a file over 5 MB', async () => {
  expect(await uploadResume(formWith('cv.pdf', 'application/pdf', 5 * 1024 * 1024 + 1))).toEqual({ ok: false, reason: 'too_large' });
});
test('unreadable PDF leaves the existing profile untouched', async () => {
  parseResume.mockRejectedValue(new AiError('unreadable'));
  expect(await uploadResume(validPdfForm())).toEqual({ ok: false, reason: 'unreadable' });
  expect(db.updates('profiles')).toEqual([]);
  expect(db.uploads()).toEqual([]);
});
test('other AI failures return ai_failed', async () => {
  parseResume.mockRejectedValue(new AiError('timeout'));
  expect(await uploadResume(validPdfForm())).toEqual({ ok: false, reason: 'ai_failed' });
});
test('success stores the file under the user folder, saves the profile and bumps profile_version', async () => {
  parseResume.mockResolvedValue(sampleResume);
  expect(await uploadResume(validPdfForm())).toEqual({ ok: true });
  expect(db.uploads()[0]).toMatchObject({ bucket: 'resumes', path: `${USER_ID}/resume.pdf` });
  expect(db.updates('profiles')[0]).toMatchObject({ resume: sampleResume, profile_version: 2 });
});
test('quota exhausted returns quota and does not call AI', async () => {
  consumeQuota.mockResolvedValue(false);
  expect(await uploadResume(validPdfForm())).toEqual({ ok: false, reason: 'quota' });
  expect(parseResume).not.toHaveBeenCalled();
});
test('savePrefs stores prefs, bumps profile_version and marks onboarded', async () => {
  await savePrefs(prefs);
  expect(db.updates('profiles')[0]).toMatchObject({ prefs, profile_version: 2, onboarded_at: expect.any(String) });
});
test('savePrefs keeps the original onboarded_at', async () => {
  db.seed('profiles', [{ user_id: USER_ID, profile_version: 4, onboarded_at: '2026-01-01T00:00:00Z' }]);
  await savePrefs(prefs);
  expect(db.updates('profiles')[0]).toMatchObject({ profile_version: 5, onboarded_at: '2026-01-01T00:00:00Z' });
});
test('updateResume saves the edited resume and bumps profile_version', async () => {
  await updateResume(sampleResume);
  expect(db.updates('profiles')[0]).toMatchObject({ resume: sampleResume, profile_version: 2 });
});
test('rejects malformed input and signed-out callers', async () => {
  await expect(savePrefs({ ...prefs, modes: ['moon'] } as never)).rejects.toThrow();
  await expect(updateResume({ skills: 'ts' } as never)).rejects.toThrow();
  db.signOut();
  await expect(savePrefs(prefs)).rejects.toThrow();
  expect(db.updates('profiles')).toEqual([]);
});
