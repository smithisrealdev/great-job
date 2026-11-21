// Live AI eval: `npm run eval` (needs ANTHROPIC_API_KEY). Judgement logic lives in checks.ts.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AiError } from '../lib/ai/client';
import { evaluateJob } from '../lib/ai/evaluate';
import { parseJobPosting } from '../lib/ai/parseJob';
import type { ParsedJob, Prefs, ResumeProfile } from '../lib/types';
import { fabricatedClaims, parseAccuracy, parseCorrect, rankingOk, type Expected, type ParseResult } from './checks';

if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY is not set; the eval makes live API calls. Set it and re-run `npm run eval`.'); process.exit(1); }

const dir = new URL('.', import.meta.url).pathname;
const txtFiles = (d: string) => { try { return readdirSync(d).filter((f) => f.endsWith('.txt')).sort().map((f) => join(d, f)); } catch { return []; } };
const en = txtFiles(join(dir, 'postings')), th = txtFiles(join(dir, 'postings', 'th'));
console.log(`English set: ${en.length} files\nThai set: ${th.length} files`);

const parsed = new Map<string, ParsedJob>();
const results: ParseResult[] = [];
for (const file of [...en, ...th]) {
  const expected: Expected = JSON.parse(readFileSync(file.replace(/\.txt$/, '.expected.json'), 'utf8'));
  let actual: ParseResult['actual'] = null;
  try {
    const job = await parseJobPosting(readFileSync(file, 'utf8'));
    parsed.set(file.split('/').pop()!, job);
    actual = { title: job.title, companyName: job.companyName, remote: job.remote };
  } catch (e) { if (!(e instanceof AiError && e.kind === 'not_a_job')) console.error(`  ${file}: ${e}`); }
  const r = { file: file.split('/').pop()!, expected, actual };
  results.push(r);
  console.log(`${parseCorrect(r) ? 'ok  ' : 'FAIL'} ${r.file}  ${actual ? `${actual.title} | ${actual.companyName} | remote=${actual.remote}` : '(not a job)'}`);
}
const acc = parseAccuracy(results);
console.log(`\nParsing: ${acc.correct}/${acc.total} = ${(acc.rate * 100).toFixed(1)}% (need 90%)`);

let bad = acc.rate < 0.9 ? 1 : 0;
for (const f of readdirSync(join(dir, 'resumes')).filter((x) => x.endsWith('.json')).sort()) {
  const { profile, prefs, ranked } = JSON.parse(readFileSync(join(dir, 'resumes', f), 'utf8')) as { profile: ResumeProfile; prefs: Prefs; ranked: string[] };
  const scores: number[] = [];
  for (const posting of ranked) {
    const job = parsed.get(posting);
    if (!job) { console.error(`  ${f}: ${posting} did not parse; cannot score`); scores.push(NaN); continue; }
    const ev = await evaluateJob(profile, prefs, job, 'en');
    scores.push(ev.score);
    for (const m of fabricatedClaims(ev.matches, profile)) { bad = 1; console.log(`  FABRICATED ${f} ${posting}: "${m}"`); }
  }
  const ok = rankingOk(scores, ranked);
  if (!ok) bad = 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ranking ${f}: ${ranked.map((p, i) => `${p}=${scores[i]}`).join('  ')}`);
}
console.log(bad ? '\nEVAL FAILED' : '\nEVAL PASSED');
process.exit(bad);
