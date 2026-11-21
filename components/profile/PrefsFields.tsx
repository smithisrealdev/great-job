'use client';
import { useTranslations } from 'next-intl';
import type { Prefs, WorkMode } from '@/lib/types';

export const ROLES = ['backend', 'frontend', 'full-stack', 'data', 'devops', 'mobile'];
export const MODES: WorkMode[] = ['remote', 'thailand', 'hybrid'];

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function PrefsFields({ prefs, onChange, extra }: { prefs: Prefs; onChange: (p: Prefs) => void; extra?: boolean }) {
  const t = useTranslations('prefs');
  const chips = <T extends string>(label: string, all: T[], on: T[], key: 'roles' | 'modes', name: (v: T) => string) => (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend style={{ fontWeight: 600, marginBottom: 6 }}>{label}</legend>
      <div className="seg">
        {all.map((v) => (
          <button key={v} type="button" aria-pressed={on.includes(v)} onClick={() => onChange({ ...prefs, [key]: toggle(on, v) })}>{name(v)}</button>
        ))}
      </div>
    </fieldset>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {chips(t('modesLabel'), MODES, prefs.modes, 'modes', (v) => t(`modes.${v}`))}
      {chips(t('rolesLabel'), ROLES, prefs.roles, 'roles', (v) => t(`roles.${v}`))}
      {extra && (
        <>
          <label>{t('minSalary')}{' '}
            <input type="number" min={0} value={prefs.minSalaryThb ?? ''} onChange={(e) => onChange({ ...prefs, minSalaryThb: e.target.value === '' ? null : Number(e.target.value) })} />
          </label>
          <label>{t('seniority')}{' '}
            <select value={prefs.seniority ?? ''} onChange={(e) => onChange({ ...prefs, seniority: (e.target.value || null) as Prefs['seniority'] })}>
              <option value="">{t('seniorityAny')}</option>
              {(['junior', 'mid', 'senior', 'lead'] as const).map((s) => <option key={s} value={s}>{t(`seniorities.${s}`)}</option>)}
            </select>
          </label>
        </>
      )}
    </div>
  );
}
