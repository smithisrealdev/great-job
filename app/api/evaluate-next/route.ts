import { NextResponse } from 'next/server';
import { AiError } from '@/lib/ai/client';
import { parseJobPosting } from '@/lib/ai/parseJob';
import { createAdminSupabase } from '@/lib/db/admin';
import { evaluateForUser } from '@/lib/db/ingest';
import { consumeQuota } from '@/lib/db/quota';
import { pickNextCandidate } from '@/lib/db/recommend';
import { createServerSupabase } from '@/lib/db/server';

// Up to two AI calls (parse, then score), each 45 s per attempt with up to 2 SDK retries: 2 x 3 x 45 s = 270 s plus backoff.
// The per-call timeout stays at 45 s because scoring with thinking needs it; the function limit is raised instead.
export const maxDuration = 300;

// Scores exactly one recommended job per call; the client loops.
export async function POST() {
  const c = await createServerSupabase();
  const { data: { user } } = await c.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const jobId = await pickNextCandidate(user.id);
  if (!jobId) return NextResponse.json({ status: 'none' });

  const { data: job } = await c.from('jobs').select('description, skills').eq('id', jobId).maybeSingle();
  if (job && !(job.skills ?? []).length && job.description && (await consumeQuota('parse_job'))) {
    try {
      const p = await parseJobPosting(job.description);
      await createAdminSupabase().from('jobs').update({ skills: p.skills, vague_description: p.vagueDescription, evergreen: p.evergreen }).eq('id', jobId);
    } catch (e) {
      if (!(e instanceof AiError)) throw e; // parse is optional: evaluate without it
    }
  }
  const r = await evaluateForUser(jobId, 'evaluate_auto');
  return NextResponse.json(r === 'failed' ? { status: 'failed', jobId } : r === 'quota' ? { status: 'quota' } : { status: 'done', jobId });
}
