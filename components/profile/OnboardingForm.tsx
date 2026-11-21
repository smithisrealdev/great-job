'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Ghost } from '@/components/ghost/Ghost';
import { savePrefs, uploadResume } from '@/lib/actions/profile';
import type { Prefs } from '@/lib/types';
import { PrefsFields } from './PrefsFields';
import { resumeFileError } from './resumeFile';

export function OnboardingForm() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>({ roles: [], modes: [], minSalaryThb: null, seniority: null });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ready = prefs.roles.length > 0 && prefs.modes.length > 0;

  const submit = () => start(async () => {
    const bad = file && resumeFileError(file);
    setError(bad || null);
    if (bad) return;
    try {
      await savePrefs(prefs);
      if (file) {
        const form = new FormData();
        form.set('resume', file);
        const res = await uploadResume(form);
        if (!res.ok) return setError(res.reason);
      }
    } catch { return setError('save_failed'); }
    router.push(`/${locale}/jobs`);
  });

  return (
    <main style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 360, margin: '0 auto', padding: 16 }}>
      <div className="hello">
        <div className="say">{t(pending && file ? 'onboarding.wait' : 'onboarding.hello')}</div>
        <Ghost mood={pending ? 'thinking' : 'wave'} size={150} label={t(`ghost.name.${pending ? 'thinking' : 'wave'}`)} />
      </div>
      <PrefsFields prefs={prefs} onChange={setPrefs} />
      <div className="drop">
        <label htmlFor="resume">{t('resume.label')}</label>
        <input id="resume" type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <p className="note">{t('resume.privacy')}</p>
      <p className="note">{t('onboarding.optional')}</p>
      {error && <p role="alert">{t(`resume.errors.${error}`)}</p>}
      {!ready && <p className="note">{t('onboarding.pickFirst')}</p>}
      <button className="btn" type="button" disabled={!ready || pending} aria-busy={pending} onClick={submit}>{t('onboarding.next')}</button>
    </main>
  );
}
