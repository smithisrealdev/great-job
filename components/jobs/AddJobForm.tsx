'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Ghost } from '@/components/ghost/Ghost';
import { FollowCompanyForm } from './FollowCompanyForm';
import { addJobFromText, addJobFromUrl, type AddJobResult } from '@/lib/actions/jobs';

export function AddJobForm() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  // The server does fetch/parse then scoring in one call; show `searching` first, then `thinking`.
  const [phase, setPhase] = useState<'searching' | 'thinking'>('searching');
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const run = (act: () => Promise<AddJobResult>) => start(async () => {
    setError(null);
    setPhase('searching');
    timer.current = setTimeout(() => setPhase('thinking'), 2500);
    let res: AddJobResult | null = null;
    try { res = await act(); } catch { /* unexpected failure, shown below */ }
    clearTimeout(timer.current);
    if (res?.ok) return router.push(`/${locale}/jobs/${res.jobId}`);
    setError(res ? res.reason : 'failed');
  });

  const mood = pending ? phase : 'idle';
  return (
    <main className="main" style={{ maxWidth: 560, margin: '0 auto' }}>
      <h1 className="ttl">{t('addJob.title')}</h1>
      <div className="hello">
        <div className="say" aria-live="polite">{pending ? t(`addJob.${phase}`) : t('addJob.hello')}</div>
        <Ghost mood={mood} size={120} label={t(`ghost.name.${mood}`)} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); run(() => addJobFromUrl(url)); }} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label htmlFor="job-url">{t('addJob.urlLabel')}</label>
        <input id="job-url" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button className="btn" type="submit" disabled={pending || !url.trim()} aria-busy={pending}>{t('addJob.urlButton')}</button>
      </form>
      <form onSubmit={(e) => { e.preventDefault(); run(() => addJobFromText(text)); }} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label htmlFor="job-text">{t('addJob.textLabel')}</label>
        <textarea id="job-text" rows={8} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn" type="submit" disabled={pending || !text.trim()} aria-busy={pending}>{t('addJob.textButton')}</button>
      </form>
      {error && <p role="alert">{t(`addJob.errors.${error}`)}</p>}
      <FollowCompanyForm />
    </main>
  );
}
