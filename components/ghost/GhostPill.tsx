import type { Mood } from '@/lib/types';
import { Ghost } from './Ghost';

export function GhostPill({ mood, label }: { mood: Mood; label: string }) {
  return (
    <div className="pill">
      <Ghost mood={mood} size={30} label={label} />
      {label}
    </div>
  );
}
