import { useId } from 'react';
import type { Mood } from '@/lib/types';

// Ported from docs/mockups/great-job-v1.html; SVG coordinates are unchanged.
type EyeKey = 'open' | 'arc' | 'closed' | 'big' | 'sad';
type MouthKey = 'w' | 'flat' | 'open' | 'o' | 'frown';
type PoseKey = 'down' | 'wave' | 'up' | 'hold' | 'cheeks';
type Arm = [number, number, number];

const EYES: Record<EyeKey, string> = {
  open: '<ellipse class="ink eye" cx="88" cy="98" rx="4.6" ry="7.6"/><ellipse class="ink eye" cx="112" cy="98" rx="4.6" ry="7.6"/>',
  arc: '<path class="line" d="M81 102 Q88 91 95 102"/><path class="line" d="M105 102 Q112 91 119 102"/>',
  closed: '<path class="line" d="M81 98 Q88 104 95 98"/><path class="line" d="M105 98 Q112 104 119 98"/>',
  big: '<circle class="ink" cx="86" cy="97" r="8.5"/><circle class="ink" cx="114" cy="97" r="8.5"/>',
  sad: '<ellipse class="ink" cx="88" cy="99" rx="4.4" ry="7" transform="rotate(20 88 99)"/><ellipse class="ink" cx="112" cy="99" rx="4.4" ry="7" transform="rotate(-20 112 99)"/>',
};
const MOUTH: Record<MouthKey, string> = {
  w: '',
  flat: '',
  open: '<path class="ink" d="M95.5 105 Q100 114 104.5 105 Z"/>',
  o: '<ellipse class="ink" cx="100" cy="110" rx="3" ry="4"/>',
  frown: '<path class="line" d="M96 112 Q100 108 104 112" style="stroke-width:2.8"/>',
};
// arm = [x, y, rotation]; "front" draws the arms over the body
const POSE: Record<PoseKey, { l: Arm; r: Arm; front?: boolean }> = {
  down: { l: [35, 134, -42], r: [165, 134, 42] },
  wave: { l: [35, 134, -42], r: [168, 94, -58] },
  up: { l: [40, 62, 58], r: [160, 62, -58] },
  hold: { l: [35, 134, -42], r: [170, 118, -12] },
  cheeks: { l: [72, 136, 24], r: [128, 136, -24], front: true },
};
const star = (x: number, y: number, s: number, c: string) =>
  `<path fill="${c}" d="M${x} ${y - s} l${s * 0.3} ${s * 0.7} ${s * 0.7} ${s * 0.3} -${s * 0.7} ${s * 0.3} -${s * 0.3} ${s * 0.7} -${s * 0.3} -${s * 0.7} -${s * 0.7} -${s * 0.3} ${s * 0.7} -${s * 0.3}z"/>`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

const props = (cheerText: string): Partial<Record<Mood, string>> => ({
  searching: '<circle class="prop" cx="192" cy="84" r="15" fill="var(--blue-wash)"/><path class="prop" d="M183 97 L174 112" style="stroke-width:5"/>',
  thinking: '<g><circle class="dot" cx="158" cy="32" r="4" fill="var(--ink)"/><circle class="dot" cx="174" cy="19" r="5.5" fill="var(--ink)"/><circle class="dot" cx="194" cy="3" r="7" fill="var(--ink)"/></g>',
  happy: star(18, 60, 11, 'var(--sun)') + star(186, 42, 8, 'var(--sun)') + star(182, 156, 6, 'var(--blush)'),
  celebrate: '<path d="M82 34 L112 -10 L122 38 Z" fill="var(--blue)" stroke="var(--ghost-edge)" stroke-width="2.5" stroke-linejoin="round"/><path d="M91 21 L118 22 M99 8 L115 9" stroke="var(--sun)" stroke-width="4" stroke-linecap="round"/><circle cx="112" cy="-12" r="7" fill="var(--blush)"/><g><rect class="conf a" x="6" y="-20" width="9" height="9" fill="var(--sun)"/><rect class="conf a" x="40" y="-34" width="8" height="8" fill="var(--blush)"/><rect class="conf a" x="150" y="-30" width="9" height="9" fill="var(--good)"/><rect class="conf a" x="186" y="-14" width="9" height="9" fill="var(--sun)"/><rect class="conf a" x="24" y="10" width="8" height="8" fill="var(--blue)"/><rect class="conf a" x="172" y="12" width="8" height="8" fill="var(--blush)"/><rect class="conf a" x="-6" y="40" width="8" height="8" fill="var(--good)"/></g>',
  spooked: '<text class="t" x="174" y="46" font-size="44" fill="var(--risk)">!</text><path class="prop" d="M18 84 L4 78 M16 102 L0 102 M18 120 L4 126"/><path d="M150 50 q6 10 0 14 q-6 -4 0 -14z" fill="var(--blue)" opacity=".7"/>',
  sad: '<path class="tear a" d="M82 106 q5 8 0 11 q-5 -3 0 -11z" fill="#6CB6FF"/>',
  cheer: `<rect x="34" y="-36" width="132" height="42" rx="12" fill="var(--sun)" stroke="var(--ghost-edge)" stroke-width="2.5"/><text class="t" x="100" y="-7" font-size="24" text-anchor="middle" fill="var(--sun-ink)">${esc(cheerText)}</text>`,
  sleepy: '<text class="t z a" x="150" y="36" font-size="22" fill="var(--ink)">z</text><text class="t z z2 a" x="168" y="14" font-size="32" fill="var(--ink)">Z</text>',
});

const LOOK: Record<Mood, { e: EyeKey; m: MouthKey; p: PoseKey }> = {
  idle: { e: 'open', m: 'w', p: 'down' },
  wave: { e: 'arc', m: 'open', p: 'wave' },
  searching: { e: 'open', m: 'w', p: 'hold' },
  thinking: { e: 'open', m: 'flat', p: 'down' },
  happy: { e: 'arc', m: 'open', p: 'down' },
  celebrate: { e: 'arc', m: 'open', p: 'up' },
  spooked: { e: 'big', m: 'o', p: 'cheeks' },
  sad: { e: 'sad', m: 'frown', p: 'down' },
  cheer: { e: 'arc', m: 'open', p: 'up' },
  sleepy: { e: 'closed', m: 'flat', p: 'down' },
};

const BODY = 'M100 22 C142 22 168 56 168 102 C168 126 170 144 180 160 C188 173 180 186 166 182 C154 178 148 170 138 176 C128 182 122 192 108 190 C96 188 92 176 80 176 C68 176 62 190 48 190 C34 190 24 178 28 162 C32 146 32 126 32 102 C32 56 58 22 100 22 Z';

const arm = (a: Arm, side: string) =>
  `<g transform="translate(${a[0]} ${a[1]}) rotate(${a[2]})"><ellipse class="arm ${side}" rx="15" ry="10.5" fill="var(--garm)"/></g>`;

/** `label` is the accessible name (pass the `ghost.name.<mood>` message); `cheerText` is the banner of the `cheer` mood. */
export function Ghost({ mood, size, label, cheerText = '' }: { mood: Mood; size: number; label?: string; cheerText?: string }) {
  const id = useId();
  const { e, m, p } = LOOK[mood];
  const pose = POSE[p];
  const arms = arm(pose.l, 'l') + arm(pose.r, 'r');
  const inner =
    (pose.front ? '' : arms) +
    '<path d="M98 26 C94 10 106 0 118 8 C109 9 106 17 108 26 Z" fill="var(--g1)"/>' +
    `<path d="${BODY}" fill="url(#${id})"/>` +
    '<rect x="60" y="78" width="80" height="40" rx="20" fill="#fff"/>' +
    EYES[e] + MOUTH[m] + (props(cheerText)[mood] ?? '') +
    (pose.front ? arms : '');
  return (
    <svg className={`ghost g-${mood}`} width={size} height={Math.round(size * 1.15)} viewBox="-24 -44 248 286" role="img" aria-label={label || mood}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--g1)' }} />
          <stop offset="1" style={{ stopColor: 'var(--g2)' }} />
        </linearGradient>
      </defs>
      <ellipse className="shadow" cx="102" cy="216" rx="46" ry="6" />
      <g className="gb" dangerouslySetInnerHTML={{ __html: inner }} />
    </svg>
  );
}
