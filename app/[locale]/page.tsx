import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Ghost } from '@/components/ghost/Ghost';

// Temporary page: proves i18n, fonts, tokens and the ghost are wired together.
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16 }}>
      <div className="say">{t('ghost.say.wave')}</div>
      <Ghost mood="wave" size={150} label={t('ghost.name.wave')} />
      <a className="btn" href={`/${locale}/login`}>{t('home.login')}</a>
    </main>
  );
}
