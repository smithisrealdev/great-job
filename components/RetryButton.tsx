'use client';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { retryEvaluation } from '@/lib/actions/jobs';

export function RetryButton({ jobId }: { jobId: string }) {
  const t = useTranslations();
  const [result, setResult] = useState<'quota' | 'failed' | null>(null);
  const [pending, start] = useTransition();
  const run = () => start(async () => {
    try { const r = await retryEvaluation(jobId); setResult(r === 'done' ? null : r); } catch { setResult('failed'); }
  });
  return (
    <div>
      <button type="button" className="btn" disabled={pending} onClick={run}>{t('jobs.retry')}</button>
      {result && <p className="note" role="status">{result === 'quota' ? t('detail.quota') : t('detail.retryFailed')}</p>}
    </div>
  );
}
