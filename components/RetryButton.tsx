'use client';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { retryEvaluation } from '@/lib/actions/jobs';

/** Shared retry handling: pending state, and a quota/failed result to show. The action revalidates the page on success. */
export function useRetry() {
  const [result, setResult] = useState<'quota' | 'failed' | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (jobId: string) => start(async () => {
    setPendingId(jobId);
    try { const r = await retryEvaluation(jobId); setResult(r === 'done' ? null : r); } catch { setResult('failed'); }
  });
  return { run, pending, pendingId: pending ? pendingId : null, result };
}

export function RetryResult({ result }: { result: 'quota' | 'failed' | null }) {
  const t = useTranslations();
  return result && <p className="note" role="status">{result === 'quota' ? t('detail.quota') : t('detail.retryFailed')}</p>;
}

export function RetryButton({ jobId }: { jobId: string }) {
  const t = useTranslations();
  const { run, pending, result } = useRetry();
  return (
    <div>
      <button type="button" className="btn" disabled={pending} onClick={() => run(jobId)}>{t('jobs.retry')}</button>
      <RetryResult result={result} />
    </div>
  );
}
