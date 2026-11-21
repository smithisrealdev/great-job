import 'server-only';
import Anthropic, { APIConnectionTimeoutError, APIError } from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import { EvaluationSchema, ParsedJobSchema, ResumeProfileSchema } from './schemas';

export class AiError extends Error {
  constructor(public kind: 'invalid_output' | 'timeout' | 'unavailable' | 'not_a_job' | 'unreadable', message?: string) {
    super(message ?? kind);
    this.name = 'AiError';
  }
}

let client: Anthropic | undefined;
// Lazy so `next build` works without ANTHROPIC_API_KEY. 45s per attempt; the SDK retries 429/5xx/connection errors twice.
const sdk = () => (client ??= new Anthropic({ timeout: 45_000, maxRetries: 2 }));

/** AI_FAKE=1 (e2e only): canned output from tests/fixtures/ai/, ignored in production builds. */
export const fakeEnabled = () => process.env.AI_FAKE === '1' && process.env.NODE_ENV !== 'production';

async function fake<T>(schema: z.ZodType<T>): Promise<T> {
  const name = schema === (ParsedJobSchema as unknown) ? 'parsedJob' : schema === (ResumeProfileSchema as unknown) ? 'resume' : schema === (EvaluationSchema as unknown) ? 'evaluation' : null;
  if (!name) throw new AiError('invalid_output', 'AI_FAKE has no fixture for this schema');
  return schema.parse((await import(`@/tests/fixtures/ai/${name}.json`)).default);
}

/** The only place that touches the SDK. */
export async function callStructured<T>(o: { model: string; system: string; content: unknown[]; schema: z.ZodType<T> }): Promise<T> {
  if (fakeEnabled()) return fake(o.schema);
  let res;
  try {
    res = await sdk().messages.create({
      model: o.model,
      max_tokens: 16_000, // covers the model's thinking plus the JSON
      system: o.system,
      messages: [{ role: 'user', content: o.content as Anthropic.ContentBlockParam[] }],
      // Thinking is always on for these models; low effort keeps it short. Extraction and scoring do not need more.
      output_config: { effort: 'low', format: zodOutputFormat(o.schema as never) },
    });
  } catch (e) {
    if (e instanceof APIConnectionTimeoutError) throw new AiError('timeout');
    // Rate limit, overload, 5xx and connection errors (after the SDK's retries), and any other API error:
    // the caller keeps its work unscored and the user can retry.
    if (e instanceof APIError) throw new AiError('unavailable', e.message);
    throw e;
  }
  if (res.stop_reason === 'max_tokens' || res.stop_reason === 'refusal') throw new AiError('invalid_output', `stopped: ${res.stop_reason}`);
  const text = res.content.find((b) => b.type === 'text');
  let json: unknown;
  try { json = JSON.parse(text && 'text' in text ? text.text : ''); } catch { throw new AiError('invalid_output', 'not JSON'); }
  const parsed = o.schema.safeParse(json);
  if (!parsed.success) throw new AiError('invalid_output', parsed.error.message);
  return parsed.data;
}

/** Wrap untrusted text as data; escaping `<` means the body can never close or open a tag. */
export const wrap = (tag: 'posting' | 'profile' | 'prefs', body: string) => `<${tag}>${body.replaceAll('<', '&lt;')}</${tag}>`;
