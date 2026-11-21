'use server';
import { z } from 'zod';
import { AiError } from '@/lib/ai/client';
import { parseJobPosting } from '@/lib/ai/parseJob';
import { detectAts } from '@/lib/core/ats';
import { fingerprint } from '@/lib/core/fingerprint';
import { consumeQuota } from '@/lib/db/quota';
import { evaluateForUser, reuseSharedJob, upsertJob } from '@/lib/db/ingest';
import { createServerSupabase } from '@/lib/db/server';
import { fetchOne, postingId } from '@/lib/sources';

const MAX_CHARS = 30_000;
export type AddJobResult = { ok: true; jobId: string } | { ok: false; reason: 'empty' | 'not_a_job' | 'unsupported_url' | 'fetch_failed' | 'ai_failed' | 'quota' | 'db_failed' };

async function userId() {
  const { data } = await (await createServerSupabase()).auth.getUser();
  if (!data.user) throw new Error('not signed in');
  return data.user.id;
}

// An evaluation failure does not fail the add: the job is kept and its evaluation row records why.
async function track(uid: string, jobId: string): Promise<AddJobResult> {
  const { error } = await (await createServerSupabase()).from('applications')
    .upsert({ user_id: uid, job_id: jobId, status: 'interested' }, { onConflict: 'user_id,job_id', ignoreDuplicates: true });
  if (error) return { ok: false, reason: 'db_failed' };
  await evaluateForUser(jobId, 'evaluate_manual');
  return { ok: true, jobId };
}

export async function addJobFromText(text: string): Promise<AddJobResult> {
  const uid = await userId();
  const body = z.string().parse(text).trim().slice(0, MAX_CHARS);
  if (!body) return { ok: false, reason: 'empty' };
  if (!(await consumeQuota('parse_job'))) return { ok: false, reason: 'quota' };
  let parsed;
  try {
    parsed = await parseJobPosting(body);
  } catch (e) {
    return { ok: false, reason: e instanceof AiError && e.kind === 'not_a_job' ? 'not_a_job' : 'ai_failed' };
  }
  try {
    const { id } = await upsertJob({
    source: 'paste', externalId: `${fingerprint(parsed.companyName, parsed.title)}:${uid}`, url: '', title: parsed.title,
    companyName: parsed.companyName, location: parsed.location, remote: parsed.remote, salaryText: parsed.salaryText,
    description: parsed.description, postedAt: parsed.postedAt,
  }, parsed, uid);
    return await track(uid, id);
  } catch { return { ok: false, reason: 'db_failed' }; }
}

export async function addJobFromUrl(url: string): Promise<AddJobResult> {
  const uid = await userId();
  const found = detectAts(z.string().max(2048).parse(url));
  if (!found) return { ok: false, reason: 'unsupported_url' };
  const externalId = postingId(found.ats, url);
  // Public data from an allowlisted source: stored as a shared row (admin client), reused when cron already has it.
  try {
    const reused = externalId ? await reuseSharedJob(found.ats, externalId) : null;
    if (reused) return await track(uid, reused);
  } catch { return { ok: false, reason: 'db_failed' }; }
  let raw;
  try { raw = await fetchOne(found.ats, found.token, url); } catch { raw = null; }
  if (!raw) return { ok: false, reason: 'fetch_failed' };
  try { return await track(uid, (await upsertJob(raw, null, null)).id); } catch { return { ok: false, reason: 'db_failed' }; }
}
