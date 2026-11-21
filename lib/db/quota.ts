import 'server-only';
import { QUOTA } from '@/lib/config';
import { createServerSupabase } from './server';

export async function consumeQuota(kind: keyof typeof QUOTA): Promise<boolean> {
  const { data, error } = await (await createServerSupabase()).rpc('consume_quota', { p_kind: kind, p_limit: QUOTA[kind] });
  return error ? false : data === true; // fail closed
}
