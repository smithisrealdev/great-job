export function ScoreRing({ score, size, label }: { score: number; size: number; label?: string }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const cls = score >= 80 ? 'hi' : score >= 65 ? 'mid' : 'lo';
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ?? String(score)}>
      <circle className="track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={3.5} />
      <circle className={cls} cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={3.5} strokeLinecap="round"
        strokeDasharray={`${(c * score) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dy=".36em" textAnchor="middle" fontSize={Math.max(10, size * 0.36)}>{score}</text>
    </svg>
  );
}
