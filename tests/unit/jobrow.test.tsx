import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

afterEach(() => { cleanup(); push.mockClear(); });
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/actions/jobs', () => ({ retryEvaluation: vi.fn() }));

import { JobRow, type JobRowJob } from '@/components/JobRow';
import th from '@/messages/th.json';

const jobPosted = (days: number): JobRowJob => ({
  id: 'j1', title: 'Platform Engineer', company_name: 'Kite', location: 'Remote', remote: true, salary_text: null,
  posted_at: new Date(Date.now() - days * 86_400_000 - 60_000).toISOString(), source: 'greenhouse', url: 'https://x.test/1',
});
const ui = (el: React.ReactElement) => <NextIntlClientProvider locale="th" messages={th}>{el}</NextIntlClientProvider>;
const draw = (el: React.ReactElement) => render(ui(el));

test('row shows score, age and risk chip', () => {
  const { getByText, container } = draw(<JobRow job={jobPosted(38)} evaluation={{ score: 81, ghost_level: 'mid' }} status="found" />);
  expect(container.querySelector('.ring')).toBeTruthy();
  expect(getByText(/38/)).toBeTruthy();
  expect(container.querySelector('.chip.warn')).toBeTruthy();
});
test('unscored row shows a retry control and no ring number', () => {
  const onRetry = vi.fn();
  const { queryByText } = draw(<JobRow job={jobPosted(2)} evaluation={{ score: null, error: 'timeout' }} status="found" onRetry={onRetry} />);
  fireEvent.click(screen.getByRole('button', { name: /ลองใหม่|retry/i }));
  expect(onRetry).toHaveBeenCalledWith('j1');
  expect(push).not.toHaveBeenCalled(); // the button does not also open the row
  expect(queryByText('0')).toBeNull();
});
test('RemoteOK row carries a followed link to the source and its name', () => {
  const { getByRole } = draw(<JobRow job={{ ...jobPosted(2), source: 'remoteok', url: 'https://remoteok.com/remote-jobs/1' }} evaluation={null} status="found" />);
  const a = getByRole('link', { name: /Remote OK/ });
  expect(a.getAttribute('href')).toBe('https://remoteok.com/remote-jobs/1');
  expect(a.getAttribute('rel') ?? '').not.toContain('nofollow');
});
test('a non-https source url is not rendered as a link', () => {
  const { queryByRole } = draw(<JobRow job={{ ...jobPosted(2), source: 'remoteok', url: 'javascript:alert(1)' }} evaluation={null} status="found" />);
  expect(queryByRole('link', { name: /Remote OK/ })).toBeNull();
});
test('job with unknown posted date shows no age chip', () => {
  const { queryByText } = draw(<JobRow job={{ ...jobPosted(2), posted_at: null }} evaluation={null} status="found" />);
  expect(queryByText(/ลงมา|posted/i)).toBeNull();
});
test('score above 100 is clamped for the ring', () => {
  const { getByRole } = draw(<JobRow job={jobPosted(1)} evaluation={{ score: 140, ghost_level: 'low' }} status="found" />);
  expect(getByRole('img', { name: /100 จาก/ })).toBeTruthy();
});
test('clicking the row opens the job', () => {
  const { container } = draw(<JobRow job={jobPosted(1)} evaluation={null} status="found" />);
  fireEvent.click(container.querySelector('.row')!);
  expect(push).toHaveBeenCalledWith('/th/jobs/j1');
});

test('a retry from the list that hits the quota says so', async () => {
  const { retryEvaluation } = await import('@/lib/actions/jobs');
  vi.mocked(retryEvaluation).mockResolvedValue('quota');
  const { JobList } = await import('@/components/JobList');
  draw(<JobList rows={[{ job: jobPosted(2), evaluation: { score: null, error: 'timeout' }, status: 'found' } as never]} />);
  fireEvent.click(screen.getByRole('button', { name: /ลองใหม่|retry/i }));
  expect((await screen.findByRole('status')).textContent).toBe(th.detail.quota);
});
