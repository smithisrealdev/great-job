import 'server-only';
import { prefilter } from '@/lib/core/prefilter';
import type { Prefs } from '@/lib/types';
import { createServerSupabase } from './server';

const WINDOW_DAYS = 14;

/**
 * Next shared job worth scoring for this user, newest first: recent, passes the coarse filter, and either never evaluated
 * or evaluated under an older profile_version without having failed.
 * shortcut: filters the newest 200 shared jobs in memory; move the filter into SQL when daily intake exceeds that
 * shortcut: evaluations has no timestamp, so any failed row (not only today's) is skipped until the user retries it
 */
export async function pickNextCandidate(userId: string): Promise<string | null> {
  const c = await createServerSupabase();
  const { data: p } = await c.from('profiles').select('prefs, resume, profile_version').eq('user_id', userId).maybeSingle();
  if (!p?.resume || !p.prefs) return null;
  const prefs: Prefs = { roles: [], modes: [], minSalaryThb: null, seniority: null, ...p.prefs };
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const [jobs, evals] = await Promise.all([
    c.from('jobs').select('id, title, remote, location').is('owner_id', null).gte('first_seen_at', cutoff).order('first_seen_at', { ascending: false }).limit(200),
    c.from('evaluations').select('job_id, profile_version, error').eq('user_id', userId),
  ]);
  const seen = new Map(((evals.data ?? []) as { job_id: string; profile_version: number | null; error: string | null }[]).map((e) => [e.job_id, e]));
  const current: number = p.profile_version ?? 0;
  const found = ((jobs.data ?? []) as { id: string; title: string; remote: boolean | null; location: string | null }[]).find((j) => {
    const e = seen.get(j.id);
    return prefilter({ ...j, remote: j.remote ?? false }, prefs) && (!e || (!e.error && (e.profile_version ?? 0) < current));
  });
  return found?.id ?? null;
}
