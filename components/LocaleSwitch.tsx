'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { routing } from '@/i18n/routing';

// Swaps the locale prefix and keeps the rest of the path and query.
export function LocaleSwitch() {
  const t = useTranslations();
  const locale = useLocale();
  const path = usePathname();
  const qs = useSearchParams().toString();
  const rest = path.replace(new RegExp(`^/${locale}`), '');
  return (
    <span className="seg" role="group" aria-label={t('nav.switchLang')}>
      {routing.locales.map((l) => (
        <Link key={l} href={`/${l}${rest}${qs ? `?${qs}` : ''}`} aria-pressed={l === locale} hrefLang={l} lang={l}>{t(`lang.${l}`)}</Link>
      ))}
    </span>
  );
}
