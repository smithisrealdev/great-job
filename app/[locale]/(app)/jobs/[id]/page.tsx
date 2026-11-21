import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Ghost } from '@/components/ghost/Ghost';
import { FindList } from '@/components/jobs/FindList';
import { RetryButton } from '@/components/RetryButton';
import { ScoreRing } from '@/components/ScoreRing';
import { StatusPanel } from '@/components/StatusPanel';
import { getJobDetail } from '@/lib/db/jobQueries';
import { safeHttps } from '@/lib/safeUrl';

export const dynamic = 'force-dynamic'; // reads the session cookie

export default async function JobDetail({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const [t, detail] = await Promise.all([getTranslations(), getJobDetail(id)]);
  if (!detail) notFound();
  const { job, evaluation: ev, status } = detail;
  const score = ev?.score ?? null;
  const level = ev?.ghost_level ?? null;
  const days = job.posted_at ? Math.max(0, Math.floor((Date.now() - Date.parse(job.posted_at)) / 86_400_000)) : 0;
  const meta = [job.company_name, job.location, job.salary_text].filter(Boolean).join(', ');
  const noResume = ev?.error === 'no_resume';

  return (
    <div className="docwrap">
      <article className="sheet">
        <div>
          <h3 className="big">{job.title}</h3>
          <div className="meta">{meta}</div>
        </div>
        <div className="score">
          {score === null ? (
            <div>
              <Ghost mood="thinking" size={44} label={t('jobs.unscored')} />
              <p>{noResume ? t('detail.noResume') : t('detail.scoreFailed')}</p>
              {noResume && <Link className="btn" href={`/${locale}/profile`}>{t('detail.uploadResume')}</Link>}
              <RetryButton jobId={job.id} />
            </div>
          ) : (
            <>
              <ScoreRing score={Math.min(100, Math.max(0, score))} size={54} label={t('jobs.score', { score })} />
              <h3>{t('detail.match', { score })}</h3>
            </>
          )}
        </div>
        {ev && (
          <>
            <FindList kind="yes" title={t('detail.yes')} items={ev.matches} />
            <FindList kind="no" title={t('detail.no')} items={ev.gaps} />
            <FindList kind="info" title={t('detail.info')} items={ev.notes} />
          </>
        )}
        {(level === 'mid' || level === 'high') && ev && (
          <div className="alert">
            <Ghost mood="spooked" size={64} label={t('ghost.name.spooked')} />
            <div>
              <h3>{t(`detail.ghostTitle.${level}`)}</h3>
              <ul>{ev.ghost_signals.map((s) => <li key={s}>{t(`ghost.signal.${s}`, { days })}</li>)}</ul>
              <span className="note">{t('detail.ghostNote')}</span>
            </div>
          </div>
        )}
      </article>
      <StatusPanel jobId={job.id} initial={status} openUrl={safeHttps(job.url)} openLabel={job.source === 'remoteok' ? t('detail.openSource') : t('detail.open')} />
    </div>
  );
}
