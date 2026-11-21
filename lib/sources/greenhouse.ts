import type { RawJob } from '@/lib/types';
import { cleanUrl, htmlToText, isoOrNull, str, type Json } from './text';

export const greenhouseUrl = (token: string) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;

export function mapGreenhouse(data: unknown, token: string): RawJob[] {
  return ((data as { jobs?: Json[] }).jobs ?? []).flatMap((j) => {
    const url = cleanUrl(j.absolute_url), title = str(j.title);
    if (!url || !title || j.id == null) return [];
    const location = str(j.location?.name);
    return [{ source: 'greenhouse' as const, externalId: String(j.id), url, title, companyName: str(j.company_name) ?? token, location,
      remote: /remote/i.test(location ?? ''), salaryText: null, description: htmlToText(String(j.content ?? '')),
      postedAt: isoOrNull(j.first_published) ?? isoOrNull(j.updated_at) }];
  });
}
