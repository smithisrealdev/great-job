import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/actions/profile', () => ({ savePrefs: vi.fn(), updateResume: vi.fn(), uploadResume: vi.fn() }));

import { ProfileForm } from '@/components/profile/ProfileForm';
import th from '@/messages/th.json';

const prefs = { roles: [], modes: [], minSalaryThb: null, seniority: null };
const page = (version: number, skill: string) => (
  <NextIntlClientProvider locale="th" messages={th}>
    <ProfileForm key={version} initialPrefs={prefs} initialResume={{ skills: [skill], experience: [], education: [], yearsTotal: 1 }} />
  </NextIntlClientProvider>
);

test('re-keying on profile_version shows the freshly parsed résumé', () => {
  const { rerender } = render(page(1, 'old-skill'));
  expect((screen.getByLabelText(/ทักษะ/) as HTMLInputElement).value).toBe('old-skill');
  rerender(page(2, 'new-skill'));
  expect((screen.getByLabelText(/ทักษะ/) as HTMLInputElement).value).toBe('new-skill');
});

afterEach(cleanup);
test.each([
  ['too_large', new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'cv.pdf', { type: 'application/pdf' })],
  ['not_pdf', new File(['hi'], 'cv.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })],
] as const)('a %s file shows its message without uploading', async (reason, file) => {
  const { uploadResume } = await import('@/lib/actions/profile');
  render(page(1, 'ts'));
  fireEvent.change(screen.getByLabelText(th.resume.label), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: th.profile.upload }));
  expect((await screen.findByRole('alert')).textContent).toBe(th.resume.errors[reason]);
  expect(uploadResume).not.toHaveBeenCalled();
});
