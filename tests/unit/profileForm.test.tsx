import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
