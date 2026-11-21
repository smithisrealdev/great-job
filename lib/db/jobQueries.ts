import { createServerSupabase } from '@/lib/db/server';
import type { JobRowEvaluation, JobRowJob } from '@/components/JobRow';
import { STATUSES } from '@/lib/statuses';
import type { GhostSignal, Status } from '@/lib/types';

export type Tab = 'recommended' | 'active' | 'all';
export interface Row { job: JobRowJob; evaluation: (JobRowEvaluation & { score: number | null }) | null; status: Status }

export { STATUSES };
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

/** Names of followed companies for the sidebar; companies are shared and readable by every signed-in user. */
export async function getFollowedCompanies(): Promise<string[]> {
  const { data } = await (await createServerSupabase()).from('companies').select('name');
  return ((data ?? []) as { name: string }[]).map((c) => c.name).sort((a, b) => a.localeCompare(b)).slice(0, 8);
}

export async function getStatusCounts(): Promise<Record<Status, number>> {
  return (await getNavCounts()).status;
}

export interface JobDetail {
  job: JobRowJob & { description: string | null };
  evaluation: { score: number | null; matches: string[]; gaps: string[]; notes: string[]; ghost_level: JobRowEvaluation['ghost_level']; ghost_signals: GhostSignal[]; error: string | null } | null;
  status: Status;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

// null when the job is not visible to the signed-in user (RLS) or nobody is signed in.
export async function getJobDetail(jobId: string): Promise<JobDetail | null> {
  const db = await createServerSupabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: job } = await db.from('jobs').select(`${JOB_COLS}, description`).eq('id', jobId).maybeSingle();
  if (!job) return null;
  const [app, evl] = await Promise.all([
    db.from('applications').select('status').eq('user_id', user.id).eq('job_id', jobId).maybeSingle(),
    db.from('evaluations').select('score, matches, gaps, notes, ghost_level, ghost_signals, error').eq('user_id', user.id).eq('job_id', jobId).maybeSingle(),
  ]);
  const e = evl.data;
  return {
    job: job as JobDetail['job'],
    status: (app.data?.status as Status | undefined) ?? 'found',
    evaluation: e && { score: e.score, matches: strings(e.matches), gaps: strings(e.gaps), notes: strings(e.notes), ghost_level: e.ghost_level, ghost_signals: strings(e.ghost_signals) as GhostSignal[], error: e.error },
  };
}
