export const QUOTA = { evaluate_manual: 30, evaluate_auto: 20, parse_resume: 5, parse_job: 60 } as const;
export const MODELS = { parse: 'claude-haiku-5-5', evaluate: 'claude-sonnet-5-5' } as const;
export const FETCH_ALLOWLIST = ['boards-api.greenhouse.io', 'api.lever.co', 'api.ashbyhq.com', 'remoteok.com'] as const;
