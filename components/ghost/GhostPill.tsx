import type { Mood } from '@/lib/types';
import { Ghost } from './Ghost';

export function GhostPill({ mood, label, cheerText }: { mood: Mood; label: string; cheerText?: string }) {
  return (
    <div className="pill">
      <Ghost mood={mood} size={30} label={label} cheerText={cheerText} />
      {label}
    </div>
  );
}
