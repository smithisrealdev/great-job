import { createServerSupabase } from '@/lib/db/server';
import type { JobRowEvaluation, JobRowJob } from '@/components/JobRow';
import type { Status } from '@/lib/types';

export type Tab = 'recommended' | 'active' | 'all';
export interface Row { job: JobRowJob; evaluation: (JobRowEvaluation & { score: number | null }) | null; status: Status }

export const STATUSES: Status[] = ['found', 'interested', 'preparing', 'applied', 'interview', 'offer', 'rejected', 'withdrawn'];
const ACTIVE: Status[] = ['interested', 'preparing', 'applied', 'interview'];
const STALE_DAYS = 7;
const JOB_COLS = 'id, title, company_name, location, remote, salary_text, posted_at, source, url';

type App = { job_id: string; status: Status; status_changed_at: string };
type Evl = { job_id: string; score: number | null; ghost_level: JobRowEvaluation['ghost_level']; ghost_signals: unknown; error: string | null };

// RLS limits both tables to the signed-in user; a missing session reads as empty.
async function load() {
  const db = await createServerSupabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const [apps, evals] = await Promise.all([
    db.from('applications').select('job_id, status, status_changed_at').eq('user_id', user.id),
    db.from('evaluations').select('job_id, score, ghost_level, ghost_signals, error').eq('user_id', user.id),
  ]);
  return { db, apps: (apps.data ?? []) as App[], evals: (evals.data ?? []) as Evl[] };
}

// Recommended = evaluated and not yet tracked beyond 'found'.
const recommendedIds = (apps: App[], evals: Evl[]) => {
  const tracked = new Map(apps.map((a) => [a.job_id, a.status]));
  return evals.filter((e) => (tracked.get(e.job_id) ?? 'found') === 'found').map((e) => e.job_id);
};

export async function getJobList(tab: Tab, status?: Status): Promise<Row[]> {
  const ctx = await load();
  if (!ctx) return [];
  const { db, apps, evals } = ctx;
  const statusOf = new Map(apps.map((a) => [a.job_id, a.status]));
  const evalOf = new Map(evals.map((e) => [e.job_id, e]));
  let ids: string[];
  if (tab === 'recommended') ids = recommendedIds(apps, evals);
  else if (tab === 'active') ids = apps.filter((a) => ACTIVE.includes(a.status)).map((a) => a.job_id);
  else ids = apps.filter((a) => !status || a.status === status).map((a) => a.job_id);
  if (!ids.length) return [];
  const { data } = await db.from('jobs').select(JOB_COLS).in('id', ids);
  const rows = ((data ?? []) as JobRowJob[]).map((job): Row => {
    const e = evalOf.get(job.id);
    return { job, status: statusOf.get(job.id) ?? 'found', evaluation: e ? { score: e.score, ghost_level: e.ghost_level, ghost_signals: e.ghost_signals, error: e.error } : null };
  });
  return rows.sort((a, b) => (b.evaluation?.score ?? -1) - (a.evaluation?.score ?? -1));
}

export async function getNavCounts() {
  const status = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  const ctx = await load();
  if (!ctx) return { status, recommended: 0, all: 0, stale: 0 };
  const cutoff = Date.now() - STALE_DAYS * 86_400_000;
  for (const a of ctx.apps) status[a.status]++;
  return {
    status,
    recommended: recommendedIds(ctx.apps, ctx.evals).length,
    all: ctx.apps.length,
    stale: ctx.apps.filter((a) => a.status === 'applied' && Date.parse(a.status_changed_at) < cutoff).length,
  };
}

export async function getStatusCounts(): Promise<Record<Status, number>> {
  return (await getNavCounts()).status;
}
