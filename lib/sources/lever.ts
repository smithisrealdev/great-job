import type { RawJob } from '@/lib/types';
import { cleanUrl, str, type Json } from './text';

export const leverUrl = (token: string) => `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`;

export function mapLever(data: unknown, token: string): RawJob[] {
  return (Array.isArray(data) ? (data as Json[]) : []).flatMap((j) => {
    const url = cleanUrl(j.hostedUrl), title = str(j.text), id = str(j.id);
    if (!url || !title || !id) return [];
    return [{ source: 'lever' as const, externalId: id, url, title, companyName: token, location: str(j.categories?.location),
      remote: j.workplaceType === 'remote', salaryText: null, description: [j.descriptionPlain, j.additionalPlain].filter(Boolean).join('\n\n'),
      postedAt: typeof j.createdAt === 'number' ? new Date(j.createdAt).toISOString() : null }];
  });
}
