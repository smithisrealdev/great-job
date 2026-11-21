import 'server-only';
import { FETCH_ALLOWLIST } from '@/lib/config';
import type { Ats, RawJob } from '@/lib/types';

/** The only network egress for job sources: https, exact allowlisted host, no redirects, 15 s timeout. */
export async function fetchJson(url: string): Promise<unknown> {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !(FETCH_ALLOWLIST as readonly string[]).includes(u.hostname)) throw new Error(`host not allowed: ${u.hostname}`);
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

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', amp: '&' };
const decode = (s: string) => s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(\w+));/gi, (m, d, h, n) =>
  d ? String.fromCodePoint(+d) : h ? String.fromCodePoint(parseInt(h, 16)) : (ENTITIES[n.toLowerCase()] ?? m));
// Greenhouse sends HTML entity-escaped, so decode, strip tags, decode again.
const htmlToText = (s: string) => decode(decode(s).replace(/<\/(p|div|li|h\d|br)>|<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')).replace(/\n{3,}/g, '\n\n').trim();

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

export async function fetchOne(ats: Ats, token: string, url: string): Promise<RawJob | null> {
  const id = postingId(ats, url);
  if (!id) return null;
  const t = encodeURIComponent(token);
  if (ats === 'greenhouse') {
    const data = (await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${t}/jobs?content=true`)) as { jobs?: Json[] };
    const j = data.jobs?.find((x) => String(x.id) === id);
    if (!j) return null;
    const location = str(j.location?.name);
    return { source: ats, externalId: id, url: j.absolute_url, title: j.title, companyName: j.company_name ?? token, location,
      remote: /remote/i.test(location ?? ''), salaryText: null, description: htmlToText(String(j.content ?? '')), postedAt: str(j.first_published) ?? str(j.updated_at) };
  }
  if (ats === 'lever') {
    const data = (await fetchJson(`https://api.lever.co/v0/postings/${t}?mode=json`)) as Json[];
    const j = data.find((x) => x.id === id);
    if (!j) return null;
    return { source: ats, externalId: id, url: j.hostedUrl, title: j.text, companyName: token, location: str(j.categories?.location),
      remote: j.workplaceType === 'remote', salaryText: null, description: [j.descriptionPlain, j.additionalPlain].filter(Boolean).join('\n\n'),
      postedAt: typeof j.createdAt === 'number' ? new Date(j.createdAt).toISOString() : null };
  }
  const data = (await fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${t}`)) as { jobs?: Json[] };
  const j = data.jobs?.find((x) => x.id === id);
  if (!j) return null;
  return { source: ats, externalId: id, url: j.jobUrl, title: j.title, companyName: token, location: str(j.location),
    remote: j.isRemote === true, salaryText: null, description: String(j.descriptionPlain ?? ''), postedAt: str(j.publishedAt) };
}
