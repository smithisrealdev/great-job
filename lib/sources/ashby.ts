import type { RawJob } from '@/lib/types';
import { cleanUrl, htmlToText, isoOrNull, str, type Json } from './text';

export const ashbyUrl = (token: string) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}`;

export function mapAshby(data: unknown, token: string): RawJob[] {
  return ((data as { jobs?: Json[] }).jobs ?? []).flatMap((j) => {
    const url = cleanUrl(j.jobUrl), title = str(j.title), id = str(j.id);
    if (!url || !title || !id) return [];
    return [{ source: 'ashby' as const, externalId: id, url, title, companyName: token, location: str(j.location),
      remote: j.isRemote === true, salaryText: null, description: str(j.descriptionPlain) ?? htmlToText(String(j.descriptionHtml ?? '')),
      postedAt: isoOrNull(j.publishedAt) }];
  });
}
