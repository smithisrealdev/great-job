import type { Ats } from '@/lib/types';

const HOSTS: Record<string, Ats> = {
  'boards.greenhouse.io': 'greenhouse',
  'job-boards.greenhouse.io': 'greenhouse',
  'jobs.lever.co': 'lever',
  'jobs.ashbyhq.com': 'ashby',
};

export function detectAts(url: string): { ats: Ats; token: string } | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const ats = HOSTS[u.hostname];
  const token = u.pathname.split('/')[1];
  return ats && token ? { ats, token } : null;
}
