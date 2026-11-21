import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { RecommendedLoader } from '@/components/RecommendedLoader';
import th from '@/messages/th.json';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const ui = <NextIntlClientProvider locale="th" messages={th}><RecommendedLoader /></NextIntlClientProvider>;

test('a remount (strict mode) still runs a loop, and two loops never call the route at once', async () => {
  let inFlight = 0, maxInFlight = 0, calls = 0;
  vi.stubGlobal('fetch', vi.fn(async () => {
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight); calls++;
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    return { ok: true, json: async () => ({ status: 'none' }) };
  }));
  const first = render(ui);
  first.unmount();
  const second = render(ui);
  await waitFor(() => expect(second.container.textContent).toContain(th.recommend.nothing));
  expect(calls).toBeGreaterThanOrEqual(1);
  expect(maxInFlight).toBe(1);
});

test('a failing route shows the error message', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
  const { container } = render(ui);
  await waitFor(() => expect(container.textContent).toContain(th.recommend.error));
});
