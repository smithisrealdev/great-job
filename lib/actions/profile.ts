'use server';
import { z } from 'zod';
import { AiError } from '@/lib/ai/client';
import { parseResume } from '@/lib/ai/parseResume';
import { consumeQuota } from '@/lib/db/quota';
import { createServerSupabase } from '@/lib/db/server';
import type { Prefs, ResumeProfile } from '@/lib/types';

const MAX_BYTES = 5 * 1024 * 1024;

const PrefsSchema = z.object({
  roles: z.array(z.string().max(60)).max(20),
  modes: z.array(z.enum(['remote', 'thailand', 'hybrid'])),
  minSalaryThb: z.number().nonnegative().nullable(),
  seniority: z.enum(['junior', 'mid', 'senior', 'lead']).nullable(),
});
const ResumeSchema = z.object({
  skills: z.array(z.string().max(100)).max(200),
  experience: z.array(z.object({ title: z.string(), company: z.string(), start: z.string(), end: z.string().nullable(), summary: z.string() })).max(50),
  education: z.array(z.object({ school: z.string(), degree: z.string() })).max(20),
  yearsTotal: z.number().nonnegative(),
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
  if (file.size > MAX_BYTES) return { ok: false, reason: 'too_large' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') return { ok: false, reason: 'not_pdf' };
  if (!(await consumeQuota('parse_resume'))) return { ok: false, reason: 'quota' };

  let resume: ResumeProfile;
  try {
    resume = await parseResume(bytes);
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
