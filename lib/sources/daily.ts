import 'server-only';
import { createAdminSupabase } from '@/lib/db/admin';
import { upsertJob } from '@/lib/db/ingest';
import type { Ats, RawJob } from '@/lib/types';
import { fetchBoard, fetchRemoteOk } from '@/lib/sources';

type Company = { id: string; name: string; ats: Ats; board_token: string };

/** Shared rows only (owner null, no AI); never deletes, so a job that left the board simply stops being refreshed. */
export async function runDailyIngest(): Promise<{ boards: number; jobs: number; errors: { source: string; message: string }[] }> {
  const { data, error } = await createAdminSupabase().from('companies').select('id, name, ats, board_token');
  const errors: { source: string; message: string }[] = [];
  if (error) {
    console.error(`ingest failed: companies: ${error.message}`);
    errors.push({ source: 'companies', message: error.message });
  }
  let boards = 0, jobs = 0;
  const run = async (source: string, load: () => Promise<RawJob[]>, companyId: string | null, name?: string) => {
    try {
      const list = await load();
      for (const raw of list) await upsertJob(name ? { ...raw, companyName: name } : raw, null, null, companyId);
      jobs += list.length;
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`ingest failed: ${source}: ${message}`);
      errors.push({ source, message });
      return false;
    }
  };
  // shortcut: one serverless invocation walks every board in sequence; split into batches when companies exceed ~300 or the run nears the function time limit
  for (const c of (data ?? []) as Company[]) {
    if (await run(`${c.ats}:${c.board_token}`, () => fetchBoard(c.ats, c.board_token), c.id, c.name)) boards++;
  }
  await run('remoteok', fetchRemoteOk, null);
  return { boards, jobs, errors };
}
