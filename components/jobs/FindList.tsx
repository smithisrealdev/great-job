const MARK = {
  yes: <path d="M3 8.5 6.5 12 13 4.500" />,
  no: null,
  info: null,
};

export function FindList({ title, items, kind }: { title: string; items: string[]; kind: keyof typeof MARK }) {
  if (!items.length) return null;
  return (
    <div>
      <h3>{title}</h3>
      <ul className="find-list">
        {items.map((x, i) => (
          <li key={i}>
            <span className={`mk ${kind}`} aria-hidden="true">{MARK[kind] && <svg viewBox="0 0 16 16">{MARK[kind]}</svg>}</span>
            <span>{x}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
