import type { ResumeProfile } from '../lib/types';

export interface Expected { title: string; companyName: string; remote: boolean; isJobPosting: boolean }
export interface Actual { title: string; companyName: string; remote: boolean }
/** actual is null when the model said "not a job posting" (or the call failed). */
export interface ParseResult { file: string; expected: Expected; actual: Actual | null }

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const near = (a: string, b: string) => { const x = norm(a), y = norm(b); return x === y || x.includes(y) || y.includes(x); };

export function parseCorrect({ expected: e, actual: a }: ParseResult): boolean {
  if (!e.isJobPosting) return a === null;
  return a !== null && near(a.title, e.title) && near(a.companyName, e.companyName) && a.remote === e.remote;
}

export function parseAccuracy(results: ParseResult[]) {
  const correct = results.filter(parseCorrect).length;
  return { correct, total: results.length, rate: results.length ? correct / results.length : 1 };
}

/** scores are in the order of `ranked` (best fit first). The best must beat the worst by 15+, and no later job may out-score an earlier one by more than 5. */
export function rankingOk(scores: number[], ranked: string[]): boolean {
  if (scores.length !== ranked.length || scores.length < 2) return false;
  if (scores[0] - scores[scores.length - 1] < 15) return false;
  return scores.every((s, i) => i === 0 || s <= scores[i - 1] + 5);
}

// shortcut: a fixed vocabulary of common tech/skill terms, not an NLP check; extend when a new fabrication slips through.
const SKILLS = ['java', 'javascript', 'typescript', 'python', 'ruby', 'golang', 'rust', 'kotlin', 'swift', 'scala', 'c++', 'c#', 'php', 'react', 'vue', 'angular', 'next.js', 'node.js', 'node', 'graphql', 'sql', 'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'kafka', 'rabbitmq', 'elasticsearch', 'kubernetes', 'docker', 'terraform', 'ansible', 'aws', 'gcp', 'azure', 'linux', 'spark', 'airflow', 'dbt', 'snowflake', 'pytorch', 'tensorflow', 'pandas', 'scikit-learn', 'llm', 'figma', 'sketch', 'prototyping', 'jira', 'tableau', 'looker', 'ci/cd', 'grpc', 'microservices', 'django', 'rails', 'spring', 'flask', 'swiftui', 'android', 'ios'];
const has = (text: string, term: string) => new RegExp(`(?<![\\p{L}\\p{N}+#])${term.replace(/[.+*?^${}()|[\]\\/]/g, '\\$&')}(?![\\p{L}\\p{N}+#])`, 'iu').test(text);

/** Match strings that name a known skill the profile has neither in `skills` nor anywhere in the experience text. */
export function fabricatedClaims(matches: string[], profile: ResumeProfile): string[] {
  const known = [profile.skills.join(' '), ...profile.experience.map((x) => `${x.title} ${x.company} ${x.summary}`), ...profile.education.map((x) => x.degree)].join(' ');
  return matches.filter((m) => SKILLS.some((t) => has(m, t) && !has(known, t)));
}
