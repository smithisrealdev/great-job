'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Ghost } from '@/components/ghost/Ghost';
import type { Status } from '@/lib/types';

const FILTERS = ['interested', 'preparing', 'applied', 'interview', 'offer'] as const;
const DOT: Record<(typeof FILTERS)[number], string> = { interested: 'var(--mute)', preparing: 'var(--sun)', applied: 'var(--blue)', interview: 'var(--good)', offer: 'var(--blush)' };
const ICON = {
  add: 'M8 3v10M3 8h10',
  star: 'M8 1.5l1.8 4.2 4.7.4-3.6 3 1.1 4.4L8 11.2 3.9 13.5 5 9.1 1.5 6.1l4.7-.4z',
  jobs: 'M2 4.5h12v9H2zM6 4.5V3h4v1.5',
  doc: 'M4 1.5h5.5L12.5 4.5v10h-8.5zM6.5 8h3.5M6.5 11h3.5',
};

export function Sidebar({ counts, recommended, all }: { counts: Record<Status, number>; recommended: number; all: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const path = usePathname();
  const q = useSearchParams();
  const onJobs = path === `/${locale}/jobs`;
  const tab = q.get('tab') ?? 'recommended';
  const status = q.get('status');
  const item = (href: string, on: boolean, icon: string, label: string, count?: number) => (
    <Link className={`it${on ? ' on' : ''}`} href={`/${locale}${href}`} aria-current={on ? 'page' : undefined}>
      <svg className="ic" viewBox="0 0 16 16" aria-hidden="true"><path d={icon} /></svg>{label}{count !== undefined && <b>{count}</b>}
    </Link>
  );
  return (
    <nav className="side" aria-label={t('nav.brand')}>
      <div className="it"><Ghost mood="idle" size={24} label={t('ghost.name.idle')} /><strong>{t('nav.brand')}</strong></div>
      {item('/jobs/new', path === `/${locale}/jobs/new`, ICON.add, t('nav.addJob'))}
      <div style={{ marginTop: 8 }} />
      {item('/jobs', onJobs && tab === 'recommended', ICON.star, t('nav.recommended'), recommended)}
      {item('/jobs?tab=all', onJobs && tab === 'all' && !status, ICON.jobs, t('nav.myJobs'), all)}
      {item('/profile', path === `/${locale}/profile`, ICON.doc, t('nav.profile'))}
      <div className="hd">{t('nav.statusHeading')}</div>
      {FILTERS.map((s) => (
        <Link key={s} className={`it${onJobs && status === s ? ' on' : ''}`} href={`/${locale}/jobs?tab=all&status=${s}`} aria-current={onJobs && status === s ? 'page' : undefined}>
          <i className="dot" style={{ background: DOT[s] }} />{t(`status.${s}`)}<b>{counts[s]}</b>
        </Link>
      ))}
    </nav>
  );
}
