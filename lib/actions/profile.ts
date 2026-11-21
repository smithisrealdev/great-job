'use server';
import { z } from 'zod';
import { AiError } from '@/lib/ai/client';
import { RESUME_LIMITS as L, RESUME_MAX_BYTES } from '@/lib/config';
import { parseResume } from '@/lib/ai/parseResume';
import { consumeQuota } from '@/lib/db/quota';
import { createServerSupabase } from '@/lib/db/server';
import type { Prefs, ResumeProfile } from '@/lib/types';

const PrefsSchema = z.object({
  roles: z.array(z.string().max(60)).max(20),
  modes: z.array(z.enum(['remote', 'thailand', 'hybrid'])),
  minSalaryThb: z.number().nonnegative().nullable(),
  seniority: z.enum(['junior', 'mid', 'senior', 'lead']).nullable(),
});
const text = (n: number) => z.string().max(n);
const ResumeSchema = z.object({
  skills: z.array(text(L.skill)).max(L.skills),
  experience: z.array(z.object({
    title: text(L.text), company: text(L.text), start: text(L.date), end: text(L.date).nullable(), summary: text(L.summary),
  })).max(L.experience),
  education: z.array(z.object({ school: text(L.text), degree: text(L.text) })).max(L.education),
  yearsTotal: z.number().nonnegative(),
});

/** AI output is trimmed to the same bounds the user's own edits must meet. */
const clampResume = (r: ResumeProfile): ResumeProfile => ({
  skills: r.skills.slice(0, L.skills).map((s) => s.slice(0, L.skill)),
  experience: r.experience.slice(0, L.experience).map((e) => ({
    title: e.title.slice(0, L.text), company: e.company.slice(0, L.text), start: e.start.slice(0, L.date),
    end: e.end?.slice(0, L.date) ?? null, summary: e.summary.slice(0, L.summary),
  })),
  education: r.education.slice(0, L.education).map((e) => ({ school: e.school.slice(0, L.text), degree: e.degree.slice(0, L.text) })),
  yearsTotal: r.yearsTotal,
});

async function current() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('not signed in');
  return { supabase, userId: data.user.id };
}

// Read-then-write: a concurrent edit could reuse a version number; acceptable for a single user's own profile.
async function patchProfile(patch: Record<string, unknown>, keepOnboarded = false) {
  const { supabase, userId } = await current();
  const { data } = await supabase.from('profiles').select('profile_version, onboarded_at').eq('user_id', userId).maybeSingle();
  const update = { ...patch, profile_version: (data?.profile_version ?? 1) + 1, ...(keepOnboarded ? { onboarded_at: data?.onboarded_at ?? new Date().toISOString() } : {}) };
  const { error } = await supabase.from('profiles').update(update).eq('user_id', userId);
  if (error) throw new Error(error.message);
  return { supabase, userId };
}

export async function savePrefs(prefs: Prefs): Promise<void> {
  await patchProfile({ prefs: PrefsSchema.parse(prefs) }, true);
}

export async function updateResume(resume: ResumeProfile): Promise<void> {
  await patchProfile({ resume: ResumeSchema.parse(resume) });
}

export type UploadResult = { ok: true } | { ok: false; reason: 'not_pdf' | 'too_large' | 'unreadable' | 'quota' | 'ai_failed' };

export async function uploadResume(form: FormData): Promise<UploadResult> {
  const { supabase, userId } = await current();
  const file = form.get('resume');
  if (!(file instanceof File)) return { ok: false, reason: 'not_pdf' };
  if (file.size > RESUME_MAX_BYTES) return { ok: false, reason: 'too_large' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') return { ok: false, reason: 'not_pdf' };
  if (!(await consumeQuota('parse_resume'))) return { ok: false, reason: 'quota' };

  let resume: ResumeProfile;
  try {
    resume = clampResume(await parseResume(bytes));
  } catch (e) {
    if (e instanceof AiError && e.kind === 'unreadable') return { ok: false, reason: 'unreadable' };
    return { ok: false, reason: 'ai_failed' };
  }
  const path = `${userId}/resume.pdf`;
  const { error } = await supabase.storage.from('resumes').upload(path, bytes, { contentType: 'application/pdf', upsert: true });
  if (error) return { ok: false, reason: 'ai_failed' };
  await patchProfile({ resume, resume_path: path });
  return { ok: true };
}
