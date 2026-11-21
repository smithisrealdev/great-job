import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi } from 'vitest';

export const fixture = (name: string) => JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures', `${name}.json`), 'utf8'));

/** Stubs fetch: the first key contained in the requested url picks the response (a number is an error status). Unmatched urls answer 404. */
export function mockFetch(routes: Record<string, unknown>) {
  const stub = vi.fn(async (url: URL | string) => {
    const hit = Object.keys(routes).find((k) => String(url).includes(k));
    const body = hit === undefined ? 404 : routes[hit];
    return typeof body === 'number' ? new Response('', { status: body }) : Response.json(body);
  });
  vi.stubGlobal('fetch', stub);
  return stub;
}
