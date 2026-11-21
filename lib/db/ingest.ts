import 'server-only';
import { getLocale } from 'next-intl/server';
import { AiError } from '@/lib/ai/client';
import { evaluateJob } from '@/lib/ai/evaluate';
import { fingerprint, normalize } from '@/lib/core/fingerprint';
import { ghostLevel, ghostSignals } from '@/lib/core/ghost';
import type { Prefs, ParsedJob, RawJob, ResumeProfile } from '@/lib/types';
import { createAdminSupabase } from './admin';
import { consumeQuota } from './quota';
import { createServerSupabase } from './server';

type Client = Awaited<ReturnType<typeof createServerSupabase>>;
const DAY = 86_400_000;
const today = () => new Date().toISOString().slice(0, 10);
const validDate = (s: string | null) => (s && !Number.isNaN(Date.parse(s)) ? s : null);

const findJob = async (c: Client, source: string, externalId: string) =>
  (await c.from('jobs').select('id').eq('source', source).eq('external_id', externalId).maybeSingle()).data as { id: string } | null;
const touch = (c: Client, id: string) => c.from('jobs').update({ last_seen_at: new Date().toISOString() }).eq('id', id);

/** Reuse a shared (cron-ingested) row, refreshing last_seen_at; null when there is none. Admin client: shared rows are service-role only. */
export async function reuseSharedJob(source: string, externalId: string): Promise<string | null> {
  const admin = createAdminSupabase();
  const { data } = await admin.from('jobs').select('id').eq('source', source).eq('external_id', externalId).is('owner_id', null).maybeSingle();
  if (!data) return null;
  await touch(admin, data.id);
  return data.id;
}

/** Shared rows (ownerId null) go through the admin client, private rows through the user's own client so RLS applies. */
export async function upsertJob(
  raw: RawJob, parsed: Pick<ParsedJob, 'skills' | 'vagueDescription' | 'evergreen'> | null, ownerId: string | null,
): Promise<{ id: string; created: boolean }> {
  const admin = createAdminSupabase();
  const c = ownerId ? await createServerSupabase() : admin;
  const fp = fingerprint(raw.companyName, raw.title);
  let id: string, created = false;
  const existing = await findJob(c, raw.source, raw.externalId);
  if (existing) {
    id = existing.id;
    await touch(c, id);
  } else {
    const { data, error } = await c.from('jobs').insert({
      owner_id: ownerId, source: raw.source, external_id: raw.externalId, url: raw.url || null, company_name: raw.companyName,
      title: raw.title, location: raw.location, remote: raw.remote, salary_text: raw.salaryText, description: raw.description,
      posted_at: validDate(raw.postedAt), fingerprint: fp, skills: parsed?.skills ?? [],
      vague_description: parsed?.vagueDescription ?? false, evergreen: parsed?.evergreen ?? false,
    }).select('id').single();
    if (error || !data) throw new Error(error?.message ?? 'insert failed');
    id = data.id; created = true;
  }
  const source_domain = raw.url ? new URL(raw.url).hostname : 'paste';
  await admin.from('job_sightings').upsert({ fingerprint: fp, source_domain, seen_on: today() }, { onConflict: 'fingerprint,source_domain,seen_on', ignoreDuplicates: true });
  return { id, created };
}

// Days a fingerprint was seen, counting only sightings at least 14 days after the previous counted one:
// a posting that stays up continuously is one sighting, a relisting is another.
function sightingDays(seen: string[]): number {
  let count = 0, last = -Infinity;
  for (const t of [...new Set(seen)].map((d) => Date.parse(d)).sort((a, b) => a - b)) {
    if (t - last >= 14 * DAY) { count++; last = t; }
  }
  return count;
}

type JobRow = {
  id: string; source: string; title: string; company_name: string | null; location: string | null; remote: boolean | null;
  salary_text: string | null; skills: string[] | null; description: string | null; posted_at: string | null;
  fingerprint: string | null; vague_description: boolean; evergreen: boolean;
};
const EMPTY_PREFS: Prefs = { roles: [], modes: [], minSalaryThb: null, seniority: null };

async function onCareersPage(c: Client, job: JobRow, fp: string): Promise<boolean | null> {
  if (!['extension', 'paste', 'remoteok'].includes(job.source) || !job.company_name) return null;
  const { data: companies } = await c.from('companies').select('id, name');
  const company = (companies as { id: string; name: string }[] | null)?.find((x) => normalize(x.name) === normalize(job.company_name!));
  if (!company) return null;
  const { data: board } = await c.from('jobs').select('fingerprint').eq('company_id', company.id);
  return (board as { fingerprint: string | null }[] | null)?.some((b) => b.fingerprint === fp) ?? false;
}

export async function evaluateForUser(jobId: string, kind: 'evaluate_manual' | 'evaluate_auto'): Promise<'done' | 'quota' | 'failed'> {
  const c = await createServerSupabase();
  const { data: { user } } = await c.auth.getUser();
  if (!user) throw new Error('not signed in');
  if (!(await consumeQuota(kind))) return 'quota';

  const { data: job } = (await c.from('jobs').select('*').eq('id', jobId).maybeSingle()) as { data: JobRow | null };
  if (!job) return 'failed';
  const { data: profile } = await c.from('profiles').select('prefs, resume, profile_version').eq('user_id', user.id).maybeSingle();

  // Ghost signals need no AI, so they are stored even when scoring fails.
  const fp = job.fingerprint ?? fingerprint(job.company_name ?? '', job.title);
  const { data: seen } = await createAdminSupabase().from('job_sightings').select('seen_on').eq('fingerprint', fp);
  const signals = ghostSignals({
    postedAt: job.posted_at, now: new Date(), sightingDays: sightingDays(((seen ?? []) as { seen_on: string }[]).map((s) => s.seen_on)),
    onCareersPage: await onCareersPage(c, job, fp), vagueDescription: job.vague_description, evergreen: job.evergreen,
  });
  const row = { user_id: user.id, job_id: jobId, ghost_level: ghostLevel(signals), ghost_signals: signals, profile_version: profile?.profile_version ?? null };
  const fail = async (error: string) => {
    await c.from('evaluations').upsert({ ...row, score: null, error });
    return 'failed' as const;
  };

  if (!profile?.resume) return fail('no_resume');
  const locale = (await getLocale()) === 'en' ? 'en' : 'th';
  const posting: ParsedJob = {
    title: job.title, companyName: job.company_name ?? '', location: job.location, remote: job.remote ?? false, salaryText: job.salary_text,
    skills: job.skills ?? [], description: job.description ?? '', postedAt: job.posted_at, vagueDescription: job.vague_description, evergreen: job.evergreen,
  };
  try {
    const e = await evaluateJob(profile.resume as ResumeProfile, { ...EMPTY_PREFS, ...profile.prefs }, posting, locale);
    await c.from('evaluations').upsert({ ...row, score: e.score, matches: e.matches, gaps: e.gaps, notes: e.notes, error: null });
    return 'done';
  } catch (e) {
    if (e instanceof AiError) return fail(e.kind);
    throw e;
  }
}
