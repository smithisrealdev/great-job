import { afterEach, expect, test, vi } from 'vitest';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@anthropic-ai/sdk', async (orig) => {
  const actual = await orig<typeof import('@anthropic-ai/sdk')>();
  class Mock { messages = { create }; static APIConnectionTimeoutError = actual.default.APIConnectionTimeoutError; }
  return { ...actual, default: Mock };
});
import { callStructured } from '@/lib/ai/client';
import { EvaluationSchema, ParsedJobSchema, ResumeProfileSchema } from '@/lib/ai/schemas';

afterEach(() => { vi.unstubAllEnvs(); create.mockReset(); });
const call = <T,>(schema: Parameters<typeof callStructured<T>>[0]['schema']) => callStructured({ model: 'm', system: 's', content: [], schema });

test('AI_FAKE=1 returns schema-valid fixtures without touching the SDK', async () => {
  vi.stubEnv('AI_FAKE', '1'); vi.stubEnv('NODE_ENV', 'test');
  expect((await call(ParsedJobSchema)).isJobPosting).toBe(true);
  expect((await call(ResumeProfileSchema)).readable).toBe(true);
  expect((await call(EvaluationSchema)).score).toBeGreaterThan(0);
  expect(create).not.toHaveBeenCalled();
});

test('AI_FAKE is ignored in production', async () => {
  vi.stubEnv('AI_FAKE', '1'); vi.stubEnv('NODE_ENV', 'production');
  create.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify({ score: 7, matches: [], gaps: [], notes: [] }) }] });
  expect((await call(EvaluationSchema)).score).toBe(7);
  expect(create).toHaveBeenCalledOnce();
});
