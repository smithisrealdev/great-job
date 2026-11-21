import type { GhostLevel, GhostSignal } from '@/lib/types';

const WEIGHT: Record<GhostSignal, number> = {
  age_30: 1, age_60: 2, reposted: 2, missing_from_careers: 2, vague_description: 1, evergreen: 2,
};

export const isGhostSignal = (s: unknown): s is GhostSignal => typeof s === 'string' && Object.hasOwn(WEIGHT, s);

export function ghostSignals(i: {
  postedAt: string | null; now: Date; sightingDays: number;
  onCareersPage: boolean | null; vagueDescription: boolean; evergreen: boolean;
}): GhostSignal[] {
  const out: GhostSignal[] = [];
  if (i.postedAt) {
    const days = Math.floor((i.now.getTime() - new Date(i.postedAt).getTime()) / 86_400_000);
    if (days > 60) out.push('age_60');
    else if (days > 30) out.push('age_30');
  }
  if (i.sightingDays >= 2) out.push('reposted');
  if (i.onCareersPage === false) out.push('missing_from_careers');
  if (i.vagueDescription) out.push('vague_description');
  if (i.evergreen) out.push('evergreen');
  return out;
}

export function ghostLevel(signals: GhostSignal[]): GhostLevel {
  const total = signals.reduce((n, s) => n + WEIGHT[s], 0);
  return total === 0 ? 'low' : total <= 3 ? 'mid' : 'high';
}
