export type NextResult = { status: 'done'; jobId: string } | { status: 'none' } | { status: 'quota' } | { status: 'failed'; jobId: string };
export type LoopEnd = 'none' | 'quota' | 'max' | 'aborted' | 'error';

/** Calls the route one job at a time. `done` counts only successfully scored jobs; a failed job is skipped (the server will not offer it again). */
export async function runRecommendLoop(
  callNext: (signal: AbortSignal) => Promise<NextResult>,
  { max, signal, onProgress }: { max: number; signal: AbortSignal; onProgress?: (done: number) => void },
): Promise<{ done: number; end: LoopEnd }> {
  let done = 0;
  for (let i = 0; i < max; i++) {
    if (signal.aborted) return { done, end: 'aborted' };
    let r: NextResult;
    try { r = await callNext(signal); } catch { return { done, end: signal.aborted ? 'aborted' : 'error' }; }
    if (signal.aborted) return { done, end: 'aborted' };
    if (r.status === 'none' || r.status === 'quota') return { done, end: r.status };
    if (r.status === 'done') { done++; onProgress?.(done); }
  }
  return { done, end: 'max' };
}
