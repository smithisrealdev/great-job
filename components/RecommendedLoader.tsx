'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Ghost } from '@/components/ghost/Ghost';
import { runRecommendLoop, type LoopEnd, type NextResult } from '@/lib/recommendLoop';

const MAX_CALLS = 20;
let running = false; // one loop at a time, even across React strict-mode double mounts

async function callNext(signal: AbortSignal): Promise<NextResult> {
  const res = await fetch('/api/evaluate-next', { method: 'POST', signal });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export function RecommendedLoader() {
  const t = useTranslations();
  const router = useRouter();
  const [done, setDone] = useState(0);
  const [end, setEnd] = useState<LoopEnd | null>(null);

  useEffect(() => {
    if (running) return;
    running = true;
    const ac = new AbortController();
    void runRecommendLoop(callNext, { max: MAX_CALLS, signal: ac.signal, onProgress: (n) => { setDone(n); router.refresh(); } })
      .then((r) => { if (r.end !== 'aborted') { setDone(r.done); setEnd(r.end); } })
      .finally(() => { running = false; });
    return () => ac.abort();
  }, [router]);

  const mood = end === null ? 'thinking' : done > 0 ? 'happy' : 'sleepy';
  const text = end === null ? t('recommend.working', { count: done }) : done > 0 ? t('recommend.found', { count: done }) : t('recommend.nothing');
  return (
    <div className="hello" aria-live="polite">
      <Ghost mood={mood} size={64} label={t(`ghost.name.${mood}`)} />
      <p>{text}</p>
    </div>
  );
}
