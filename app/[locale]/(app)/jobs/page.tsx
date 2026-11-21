import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Ghost } from '@/components/ghost/Ghost';
import { JobList } from '@/components/JobList';
import { getJobList, STATUSES, type Tab } from '@/lib/db/jobQueries';
import type { Status } from '@/lib/types';

export const dynamic = 'force-dynamic'; // reads the session cookie

const TABS: Tab[] = ['recommended', 'active', 'all'];

export default async function Jobs({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ tab?: string; status?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const status = STATUSES.find((s): s is Status => s === sp.status);
  const tab = status ? 'all' : (TABS.find((x) => x === sp.tab) ?? 'recommended');
  const [t, rows] = await Promise.all([getTranslations(), getJobList(tab, status)]);
  return (
    <>
      <div className="ttl">
        <Link className="plus" href={`/${locale}/jobs/new`} aria-label={t('nav.addJob')}><svg className="ic" viewBox="0 0 16 16"><path d="M8 3.5v9M3.5 8h9" /></svg></Link>
        <h2>{status ? t(`status.${status}`) : t(`jobs.title.${tab}`)}</h2>
      </div>
      <div className="seg">
        {TABS.map((x) => (
          <Link key={x} href={`/${locale}/jobs${x === 'recommended' ? '' : `?tab=${x}`}`} aria-pressed={!status && x === tab}>{t(`jobs.tabs.${x}`)}</Link>
        ))}
      </div>
      {rows.length ? <JobList rows={rows} /> : (
        <div className="hello">
          <Ghost mood="sleepy" size={90} label={t('ghost.name.sleepy')} />
          <p>{t('jobs.empty')}</p>
          <Link className="btn" href={`/${locale}/jobs/new`}>{t('jobs.emptyAction')}</Link>
        </div>
      )}
    </>
  );
}
