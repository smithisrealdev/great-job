'use client';
import { JobRow } from '@/components/JobRow';
import { RetryResult, useRetry } from '@/components/RetryButton';
import type { Row } from '@/lib/db/jobQueries';

// Client boundary so rows can take an onRetry handler; the action revalidates the list.
export function JobList({ rows }: { rows: Row[] }) {
  const { run, pendingId, result } = useRetry();
  return (
    <>
      <RetryResult result={result} />
      <div className="rows">{rows.map((r) => <JobRow key={r.job.id} {...r} onRetry={run} retrying={pendingId === r.job.id} />)}</div>
    </>
  );
}
