import Link from 'next/link';
import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { GhostPill } from '@/components/ghost/GhostPill';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { Sidebar } from '@/components/Sidebar';
import { getFollowedCompanies, getNavCounts } from '@/lib/db/jobQueries';

export const dynamic = 'force-dynamic'; // reads the session cookie

// Middleware guarantees a signed-in, onboarded user; without a session the counts simply read as zero.
export default async function AppLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, nav, companies] = await Promise.all([getTranslations(), getNavCounts(), getFollowedCompanies()]);
  const stale = nav.stale > 0;
  return (
    <>
      <div className="top">
        <Link href={`/${locale}/jobs`} aria-label={t('nav.brand')}><strong>{t('nav.brand')}</strong></Link>
        <div className="find" aria-hidden="true"><svg className="ic" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 14 14" /></svg>{t('nav.search')}</div>
        <div className="r">
          <Link href={`/${locale}/jobs/new`}>{t('nav.addJob')}</Link>
          <Link href={`/${locale}/profile`}>{t('nav.profile')}</Link>
          <Suspense><LocaleSwitch /></Suspense>
        </div>
      </div>
      <div className="app">
        <Suspense><Sidebar counts={nav.status} recommended={nav.recommended} all={nav.all} companies={companies} /></Suspense>
        <main className="main">{children}</main>
        <div className="float" style={{ position: 'fixed' }}>
          <GhostPill
            mood={stale ? 'cheer' : 'idle'}
            label={stale ? t('jobs.pillFollowUp', { count: nav.stale }) : t('jobs.pillIdle')}
            cheerText={stale ? t('ghost.cheerBanner') : undefined}
          />
        </div>
      </div>
    </>
  );
}
