import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';

export class AiError extends Error {
  constructor(public kind: 'invalid_output' | 'timeout' | 'not_a_job' | 'unreadable', message?: string) {
    super(message ?? kind);
    this.name = 'AiError';
  }
}

let client: Anthropic | undefined;
// Lazy so `next build` works without ANTHROPIC_API_KEY. 45s timeout, no automatic retry.
const sdk = () => (client ??= new Anthropic({ timeout: 45_000, maxRetries: 0 }));

/** The only place that touches the SDK. */
export async function callStructured<T>(o: { model: string; system: string; content: unknown[]; schema: z.ZodType<T> }): Promise<T> {
  let res;
  try {
    res = await sdk().messages.create({
      model: o.model,
      max_tokens: 4096,
      system: o.system,
      messages: [{ role: 'user', content: o.content as Anthropic.ContentBlockParam[] }],
      output_config: { format: zodOutputFormat(o.schema as never) },
    });
  } catch (e) {
    if (e instanceof Anthropic.APIConnectionTimeoutError) throw new AiError('timeout');
    throw e;
  }
  const text = res.content.find((b) => b.type === 'text');
  let json: unknown;
  try { json = JSON.parse(text && 'text' in text ? text.text : ''); } catch { throw new AiError('invalid_output', 'not JSON'); }
  const parsed = o.schema.safeParse(json);
  if (!parsed.success) throw new AiError('invalid_output', parsed.error.message);
  return parsed.data;
}

/** Wrap untrusted text as data; escaping `<` means the body can never close or open a tag. */
export const wrap = (tag: 'posting' | 'profile' | 'prefs', body: string) => `<${tag}>${body.replaceAll('<', '&lt;')}</${tag}>`;
