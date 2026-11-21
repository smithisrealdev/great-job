'use client';
import { JobRow } from '@/components/JobRow';
import type { Row } from '@/lib/db/jobQueries';

// Client boundary so rows can take an onRetry handler; Task 8 wires `retryEvaluation` here.
export function JobList({ rows }: { rows: Row[] }) {
  return <div className="rows">{rows.map((r) => <JobRow key={r.job.id} {...r} />)}</div>;
}
