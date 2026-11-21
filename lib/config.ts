export const QUOTA = { evaluate_manual: 30, evaluate_auto: 20, parse_resume: 5, parse_job: 60 } as const;
export const MODELS = { parse: 'claude-haiku-5-5', evaluate: 'claude-sonnet-5-5' } as const;
export const FETCH_ALLOWLIST = ['boards-api.greenhouse.io', 'api.lever.co', 'api.ashbyhq.com', 'remoteok.com'] as const;
// Vercel rejects request bodies over 4.5 MB before a server action runs, so the résumé cap sits below that.
export const RESUME_MAX_BYTES = 4 * 1024 * 1024;
// The résumé goes into every scoring prompt, so its size is bounded (user edits are rejected, AI output is truncated).
export const RESUME_LIMITS = { text: 200, date: 40, summary: 2000, skill: 80, skills: 80, experience: 30, education: 10 } as const;
