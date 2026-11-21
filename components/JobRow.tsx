'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Ghost } from '@/components/ghost/Ghost';
import { RiskChip } from '@/components/RiskChip';
import { ScoreRing } from '@/components/ScoreRing';
import { moodForJob } from '@/lib/core/mood';
import { safeHttps } from '@/lib/safeUrl';
import type { GhostLevel, Source, Status } from '@/lib/types';

export interface JobRowJob {
  id: string; title: string; company_name: string | null; location: string | null; remote: boolean | null;
  salary_text: string | null; posted_at: string | null; source: Source; url: string | null;
}
export interface JobRowEvaluation { score: number | null; ghost_level?: GhostLevel | null; ghost_signals?: unknown; error?: string | null }

const DAY = 86_400_000;

export function JobRow({ job, evaluation, onRetry = () => {}, retrying = false }: {
  job: JobRowJob; evaluation: JobRowEvaluation | null; status: Status; onRetry?: (jobId: string) => void; retrying?: boolean;
}) {
  const t = useTranslations('jobs');
  const locale = useLocale();
  const router = useRouter();
  const score = evaluation?.score ?? null;
  const level = evaluation?.ghost_level ?? null;
  const days = job.posted_at ? Math.max(0, Math.floor((Date.now() - Date.parse(job.posted_at)) / DAY)) : null;
  const place = [job.company_name, job.location].filter(Boolean).join(', ');
  const href = `/${locale}/jobs/${job.id}`;

  return (
    <div className="row" onClick={() => router.push(href)}>
      {score === null
        ? <Ghost mood={moodForJob(null, level)} size={26} label={t('unscored')} />
        : <ScoreRing score={Math.min(100, Math.max(0, score))} size={30} label={t('score', { score: Math.min(100, Math.max(0, score)) })} />}
      <div className="nm">
        <b><Link href={href} onClick={(e) => e.stopPropagation()}>{job.title}</Link></b>
        <span>{place}</span>
      </div>
      <div className="tags">
        {job.salary_text && <span className="chip">{job.salary_text}</span>}
        {days !== null && <span className="chip">{t('age', { days })}</span>}
        {level && <RiskChip level={level} />}
        {score === null && evaluation && (
          <button type="button" className="chip" disabled={retrying} aria-busy={retrying} onClick={(e) => { e.stopPropagation(); onRetry(job.id); }}>{t('retry')}</button>
        )}
        {job.source === 'remoteok' && safeHttps(job.url) && (
          <a className="chip" href={safeHttps(job.url)!} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>{t('source.remoteok')}</a>
        )}
      </div>
    </div>
  );
}
