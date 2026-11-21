'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { savePrefs, updateResume, uploadResume } from '@/lib/actions/profile';
import type { Prefs, ResumeProfile } from '@/lib/types';
import { PrefsFields } from './PrefsFields';

type Exp = ResumeProfile['experience'][number];
const blankExp: Exp = { title: '', company: '', start: '', end: null, summary: '' };

export function ProfileForm({ initialPrefs, initialResume }: { initialPrefs: Prefs; initialResume: ResumeProfile }) {
  const t = useTranslations();
  const router = useRouter();
  const [prefs, setPrefs] = useState(initialPrefs);
  const [resume, setResume] = useState(initialResume);
  const [skills, setSkills] = useState(initialResume.skills.join(', '));
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<string | void>) => start(async () => {
    setMsg(null);
    try {
      const failed = await fn();
      setMsg(failed ? { ok: false, text: t(`resume.errors.${failed}`) } : { ok: true, text: t('profile.saved') });
      if (!failed) router.refresh();
    } catch { setMsg({ ok: false, text: t('resume.errors.save_failed') }); }
  });
  const setExp = (i: number, patch: Partial<Exp>) => setResume({ ...resume, experience: resume.experience.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  const setEdu = (i: number, patch: Partial<ResumeProfile['education'][number]>) => setResume({ ...resume, education: resume.education.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  const field = (label: string, value: string, onChange: (v: string) => void, id: string) => (
    <label htmlFor={id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{label}
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
  const gap = { display: 'flex', flexDirection: 'column', gap: 12 } as const;

  return (
    <main style={{ ...gap, maxWidth: 640, margin: '0 auto', padding: 16, gap: 28 }}>
      <h1>{t('profile.title')}</h1>
      <div aria-live="polite">{msg && <p role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}</div>

      <section style={gap} aria-labelledby="h-prefs">
        <h2 id="h-prefs">{t('profile.prefsTitle')}</h2>
        <PrefsFields prefs={prefs} onChange={setPrefs} extra />
        <button className="btn" type="button" disabled={pending} onClick={() => run(() => savePrefs(prefs))}>{t('profile.savePrefs')}</button>
      </section>

      <section style={gap} aria-labelledby="h-resume">
        <h2 id="h-resume">{t('profile.resumeTitle')}</h2>
        {field(t('profile.skills'), skills, setSkills, 'skills')}
        <label htmlFor="years" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{t('profile.years')}
          <input id="years" type="number" min={0} value={resume.yearsTotal} onChange={(e) => setResume({ ...resume, yearsTotal: Number(e.target.value) })} />
        </label>
        <h3>{t('profile.experience')}</h3>
        {resume.experience.map((e, i) => (
          <fieldset key={i} style={{ ...gap, padding: 12 }}>
            {field(t('profile.jobTitle'), e.title, (v) => setExp(i, { title: v }), `exp-title-${i}`)}
            {field(t('profile.company'), e.company, (v) => setExp(i, { company: v }), `exp-company-${i}`)}
            {field(t('profile.start'), e.start, (v) => setExp(i, { start: v }), `exp-start-${i}`)}
            {field(t('profile.end'), e.end ?? '', (v) => setExp(i, { end: v || null }), `exp-end-${i}`)}
            <label htmlFor={`exp-summary-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{t('profile.summary')}
              <textarea id={`exp-summary-${i}`} rows={3} value={e.summary} onChange={(ev) => setExp(i, { summary: ev.target.value })} />
            </label>
            <button className="btn quiet" type="button" onClick={() => setResume({ ...resume, experience: resume.experience.filter((_, j) => j !== i) })}>{t('profile.removeExperience')}</button>
          </fieldset>
        ))}
        <button className="btn quiet" type="button" onClick={() => setResume({ ...resume, experience: [...resume.experience, blankExp] })}>{t('profile.addExperience')}</button>
        <h3>{t('profile.education')}</h3>
        {resume.education.map((e, i) => (
          <fieldset key={i} style={{ ...gap, padding: 12 }}>
            {field(t('profile.school'), e.school, (v) => setEdu(i, { school: v }), `edu-school-${i}`)}
            {field(t('profile.degree'), e.degree, (v) => setEdu(i, { degree: v }), `edu-degree-${i}`)}
            <button className="btn quiet" type="button" onClick={() => setResume({ ...resume, education: resume.education.filter((_, j) => j !== i) })}>{t('profile.removeEducation')}</button>
          </fieldset>
        ))}
        <button className="btn quiet" type="button" onClick={() => setResume({ ...resume, education: [...resume.education, { school: '', degree: '' }] })}>{t('profile.addEducation')}</button>
        <button className="btn" type="button" disabled={pending}
          onClick={() => run(() => updateResume({ ...resume, skills: skills.split(',').map((s) => s.trim()).filter(Boolean) }))}>{t('profile.saveResume')}</button>
      </section>

      <section style={gap} aria-labelledby="h-upload">
        <h2 id="h-upload">{t('profile.uploadTitle')}</h2>
        <div className="drop">
          <label htmlFor="resume">{t('resume.label')}</label>
          <input id="resume" type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <p className="note">{t('resume.privacy')}</p>
        <button className="btn" type="button" disabled={!file || pending} aria-busy={pending}
          onClick={() => run(async () => {
            const form = new FormData();
            form.set('resume', file!);
            const res = await uploadResume(form);
            if (!res.ok) return res.reason;
            setFile(null);
          })}>{t('profile.upload')}</button>
      </section>
    </main>
  );
}
