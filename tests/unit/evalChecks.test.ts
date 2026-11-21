import { expect, test } from 'vitest';
import { fabricatedClaims, parseAccuracy, rankingOk, type ParseResult } from '@/evals/checks';

const e = { title: 'Backend Engineer', companyName: 'Stripe', remote: false, isJobPosting: true };
const r = (actual: ParseResult['actual'], expected = e): ParseResult => ({ file: 'x', expected, actual });

test('parseAccuracy counts matches loosely on title/company and exactly on remote', () => {
  const res = [
    r({ title: 'Backend Engineer, Link', companyName: 'stripe', remote: false }),
    r({ title: 'Backend Engineer', companyName: 'Stripe', remote: true }),
    r(null),
    r(null, { ...e, isJobPosting: false }),
    r({ title: 'x', companyName: 'y', remote: false }, { ...e, isJobPosting: false }),
  ];
  expect(parseAccuracy(res)).toEqual({ correct: 2, total: 5, rate: 0.4 });
  expect(parseAccuracy([]).rate).toBe(1);
});

test('rankingOk needs a 15 point spread and a near-monotone order', () => {
  const names = ['a', 'b', 'c'];
  expect(rankingOk([90, 70, 40], names)).toBe(true);
  expect(rankingOk([90, 80, 76], names)).toBe(false);   // spread 14
  expect(rankingOk([90, 70, 75], names)).toBe(true);    // 5 tolerance
  expect(rankingOk([90, 60, 66], names)).toBe(false);   // 6 over
  expect(rankingOk([40, 60, 90], names)).toBe(false);
  expect(rankingOk([90], ['a'])).toBe(false);
});

test('fabricatedClaims flags skills the profile does not have', () => {
  const profile = { skills: ['Java', 'PostgreSQL'], experience: [{ title: 'Dev', company: 'Acme', start: '2020', end: null, summary: 'Ran Kafka pipelines' }], education: [], yearsTotal: 4 };
  expect(fabricatedClaims(['Strong Java and Kafka experience', 'Knows Kubernetes and Docker', 'Good communicator', 'JavaScript frontend'], profile))
    .toEqual(['Knows Kubernetes and Docker', 'JavaScript frontend']);   // "java" must not match inside "javascript"
});
