import { test, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Ghost } from '@/components/ghost/Ghost';
import { ScoreRing } from '@/components/ScoreRing';
import type { Mood } from '@/lib/types';

const MOODS: Mood[] = ['idle','wave','searching','thinking','happy','celebrate','spooked','sad','cheer','sleepy'];
test.each(MOODS)('renders %s with its own class and a label', (m) => {
  const { container } = render(<Ghost mood={m} size={100} />);
  const svg = container.querySelector('svg')!;
  expect(svg.classList.contains(`g-${m}`)).toBe(true);
  expect(svg.getAttribute('aria-label')).toBeTruthy();
});
test('two ghosts on one page get different gradient ids', () => {
  const { container } = render(<><Ghost mood="idle" size={40}/><Ghost mood="idle" size={40}/></>);
  const ids = [...container.querySelectorAll('linearGradient')].map(g => g.id);
  expect(new Set(ids).size).toBe(2);
});
test('ScoreRing picks band by score', () => {
  expect(render(<ScoreRing score={88} size={30}/>).container.querySelector('.hi')).toBeTruthy();
  expect(render(<ScoreRing score={74} size={30}/>).container.querySelector('.mid')).toBeTruthy();
  expect(render(<ScoreRing score={50} size={30}/>).container.querySelector('.lo')).toBeTruthy();
});
