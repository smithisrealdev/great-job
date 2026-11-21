'use client';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Ghost } from '@/components/ghost/Ghost';
import { setStatus } from '@/lib/actions/jobs';
import { STATUSES } from '@/lib/statuses';
import { moodForStatus } from '@/lib/core/mood';
import type { Status } from '@/lib/types';

export function StatusPanel({ jobId, initial, openUrl, openLabel }: { jobId: string; initial: Status; openUrl: string | null; openLabel: string }) {
  const t = useTranslations();
  const [status, setLocal] = useState<Status>(initial);
  const [failed, setFailed] = useState(false);
  const [, start] = useTransition();

  const choose = (next: Status) => {
    if (next === status) return;
    const prev = status;
    setLocal(next); // optimistic: the ghost reacts at once
    setFailed(false);
    start(async () => {
      let ok = false;
      try { ok = (await setStatus(jobId, next)).ok; } catch { /* network or server error: revert below */ }
      if (!ok) { setLocal(prev); setFailed(true); }
    });
  };

  const mood = moodForStatus(status);
  return (
    <aside className="insp">
      <div className="react">
        <div className="say" role="status">{failed ? t('detail.statusFailed') : t(`status.say.${status}`)}</div>
        <Ghost mood={mood} size={110} label={t(`ghost.name.${mood}`)} />
      </div>
      <h3>{t('nav.statusHeading')}</h3>
      <div className="status" role="group" aria-label={t('nav.statusHeading')}>
        {STATUSES.map((s) => (
          <button key={s} type="button" aria-pressed={s === status} onClick={() => choose(s)}><i />{t(`status.${s}`)}</button>
        ))}
      </div>
      {openUrl && <a className="btn quiet" href={openUrl} target="_blank" rel="noopener">{openLabel}</a>}
    </aside>
  );
}
