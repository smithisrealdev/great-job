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
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  const ats = HOSTS[u.hostname];
  const token = u.pathname.split('/')[1];
  return ats && /^[A-Za-z0-9_-]+$/.test(token) ? { ats, token } : null;
}
