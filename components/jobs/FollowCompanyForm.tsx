'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { followCompany } from '@/lib/actions/jobs';

export function FollowCompanyForm() {
  const t = useTranslations('addJob');
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; key: string } | null>(null);
  const [pending, start] = useTransition();

  const submit = () => start(async () => {
    setMsg(null);
    let res;
    try { res = await followCompany(url); } catch { /* unexpected failure, shown below */ }
    if (res?.ok) { setUrl(''); router.refresh(); }
    setMsg(res?.ok ? { ok: true, key: 'followed' } : { ok: false, key: `followErrors.${res ? res.reason : 'failed'}` });
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h2>{t('followTitle')}</h2>
      <label htmlFor="follow-url">{t('followLabel')}</label>
      <input id="follow-url" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} />
      <button className="btn" type="submit" disabled={pending || !url.trim()} aria-busy={pending}>{t('followButton')}</button>
      {msg && <p role={msg.ok ? 'status' : 'alert'}>{t(msg.key)}</p>}
    </form>
  );
}
