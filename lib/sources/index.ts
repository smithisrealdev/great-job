import 'server-only';
import { FETCH_ALLOWLIST } from '@/lib/config';
import type { Ats, RawJob } from '@/lib/types';
import { ashbyUrl, mapAshby } from './ashby';
import { greenhouseUrl, mapGreenhouse } from './greenhouse';
import { leverUrl, mapLever } from './lever';
import { mapRemoteOk, REMOTEOK_URL } from './remoteok';

/** The only network egress for job sources: https, exact allowlisted host, no redirects, 15 s timeout. */
export async function fetchJson(url: string): Promise<unknown> {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !(FETCH_ALLOWLIST as readonly string[]).includes(u.hostname)) throw new Error(`host not in allowlist: ${u.hostname}`);
  const res = await fetch(u, { headers: { 'User-Agent': 'GreatJobBot/1.0' }, signal: AbortSignal.timeout(15_000), redirect: 'error' });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return res.json();
}

/** Posting id named by a supported ATS url, or null when the url is a whole board. */
export function postingId(ats: Ats, url: string): string | null {
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  const id = ats === 'greenhouse' ? (parts[1] === 'jobs' ? parts[2] : undefined) : parts[1];
  return id && /^[A-Za-z0-9_-]+$/.test(id) && (ats !== 'greenhouse' || /^\d+$/.test(id)) ? id : null;
}

export async function fetchBoard(ats: Ats, token: string): Promise<RawJob[]> {
  if (ats === 'greenhouse') return mapGreenhouse(await fetchJson(greenhouseUrl(token)), token);
  if (ats === 'lever') return mapLever(await fetchJson(leverUrl(token)), token);
  return mapAshby(await fetchJson(ashbyUrl(token)), token);
}

export async function fetchRemoteOk(): Promise<RawJob[]> {
  return mapRemoteOk(await fetchJson(REMOTEOK_URL));
}

export async function fetchOne(ats: Ats, token: string, url: string): Promise<RawJob | null> {
  const id = postingId(ats, url);
  return id ? ((await fetchBoard(ats, token)).find((j) => j.externalId === id) ?? null) : null;
}
