import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Ghost } from '@/components/ghost/Ghost';
import { signInWithEmail, signInWithGoogle } from './actions';

export default async function Login({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { locale } = await params;
  const { sent, error } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16, maxWidth: 360 }}>
      <div className="say">{t('ghost.say.wave')}</div>
      <Ghost mood="wave" size={150} label={t('ghost.name.wave')} />
      <h1>{t('login.title')}</h1>
      <form action={signInWithGoogle.bind(null, locale)}>
        <button className="btn" type="submit">{t('login.google')}</button>
      </form>
      <form action={signInWithEmail.bind(null, locale)} style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
        <label htmlFor="email">{t('login.emailLabel')}</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
        <button className="btn" type="submit">{t('login.sendLink')}</button>
      </form>
      {sent && <p role="status">{t('login.sent')}</p>}
      {error && <p role="alert">{t('login.error')}</p>}
    </main>
  );
}
