import type { GhostLevel, Mood, Status } from '@/lib/types';

const BY_STATUS: Record<Status, Mood> = {
  found: 'idle', interested: 'happy', preparing: 'thinking', applied: 'wave',
  interview: 'celebrate', offer: 'celebrate', rejected: 'cheer', withdrawn: 'idle',
};

export const moodForStatus = (s: Status): Mood => BY_STATUS[s];

export function moodForJob(score: number | null, level: GhostLevel | null): Mood {
  if (score === null) return 'thinking';
  if (level === 'high') return 'spooked';
  return score >= 80 ? 'happy' : 'idle';
}
