'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/db/server';

async function callbackUrl(locale: string) {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}/auth/callback?next=${encodeURIComponent(`/${locale}`)}`;
}

export async function signInWithGoogle(locale: string) {
  const { data, error } = await (await createServerSupabase()).auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: await callbackUrl(locale) },
  });
  redirect(error || !data.url ? `/${locale}/login?error=1` : data.url);
}

export async function signInWithEmail(locale: string, formData: FormData) {
  const { error } = await (await createServerSupabase()).auth.signInWithOtp({
    email: String(formData.get('email') ?? ''),
    options: { emailRedirectTo: await callbackUrl(locale) },
  });
  redirect(`/${locale}/login?${error ? 'error=1' : 'sent=1'}`);
}
