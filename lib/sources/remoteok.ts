import type { RawJob } from '@/lib/types';
import { cleanUrl, htmlToText, isoOrNull, str, type Json } from './text';

export const REMOTEOK_URL = 'https://remoteok.com/api';

/** The first element is a legal notice, not a job. */
export function mapRemoteOk(data: unknown): RawJob[] {
  return (Array.isArray(data) ? (data as Json[]).slice(1) : []).flatMap((j) => {
    const url = cleanUrl(j.url), title = str(j.position), id = str(j.id);
    if (!url || !title || !id) return [];
    const max = Number(j.salary_max) || 0, min = Number(j.salary_min) || 0;
    return [{ source: 'remoteok' as const, externalId: id, url, title, companyName: str(j.company) ?? '', location: str(j.location),
      remote: true, salaryText: max > 0 ? `$${min.toLocaleString('en-US')}-$${max.toLocaleString('en-US')}` : null,
      description: htmlToText(String(j.description ?? '')), postedAt: isoOrNull(j.date) }];
  });
}
