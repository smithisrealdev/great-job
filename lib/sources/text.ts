import { safeHttps } from '@/lib/safeUrl';

export type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
export const isoOrNull = (v: unknown) => { const s = str(v); return s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString() : null; };
/** https url with a lowercase host, or null when the url is unusable (the job is then skipped). */
export const cleanUrl = (v: unknown) => { const s = safeHttps(str(v)); try { return s ? new URL(s).href : null; } catch { return null; } };

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', amp: '&' };
const decode = (s: string) => s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(\w+));/gi, (m, d, h, n) =>
  d ? String.fromCodePoint(+d) : h ? String.fromCodePoint(parseInt(h, 16)) : (ENTITIES[n.toLowerCase()] ?? m));
// Greenhouse sends HTML entity-escaped, so decode, strip tags, decode again.
export const htmlToText = (s: string) => decode(decode(s).replace(/<\/(p|div|li|h\d|br)>|<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')).replace(/\n{3,}/g, '\n\n').trim();
