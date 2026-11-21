'use client';
import { JobRow } from '@/components/JobRow';
import { retryEvaluation } from '@/lib/actions/jobs';
import type { Row } from '@/lib/db/jobQueries';

// Client boundary so rows can take an onRetry handler; the action revalidates the list.
export function JobList({ rows }: { rows: Row[] }) {
  return <div className="rows">{rows.map((r) => <JobRow key={r.job.id} {...r} onRetry={(id) => { void retryEvaluation(id); }} />)}</div>;
}
