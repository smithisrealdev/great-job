import { useTranslations } from 'next-intl';
import type { GhostLevel } from '@/lib/types';

const CLS: Record<GhostLevel, string> = { low: 'good', mid: 'warn', high: 'risk' };

export function RiskChip({ level }: { level: GhostLevel }) {
  const t = useTranslations('jobs.risk');
  return (
    <span className={`chip ${CLS[level]}`}>
      <svg viewBox="0 0 22 24" aria-hidden="true"><path d="M2 11 C2 5 6 1 11 1 C16 1 20 5 20 11 L20 22 Q17.7 24 15.5 22 Q13.3 20 11 22 Q8.7 24 6.500 22 Q4.300 20 2 22 Z" /></svg>
      {t(level)}
    </span>
  );
}
