'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/db/server';

async function callbackUrl(locale: string) {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}/auth/callback?next=${encodeURIComponent(`/${locale}/jobs`)}`;
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

/** Test-only: the form that calls this renders only when NEXT_PUBLIC_E2E=1, and never in production. */
export async function signInWithPassword(locale: string, formData: FormData) {
  if (process.env.NEXT_PUBLIC_E2E !== '1' || process.env.NODE_ENV === 'production') redirect(`/${locale}/login?error=1`);
  const { error } = await (await createServerSupabase()).auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  });
  redirect(error ? `/${locale}/login?error=1` : `/${locale}/jobs`);
}

export async function signOut(locale: string) {
  await (await createServerSupabase()).auth.signOut();
  redirect(`/${locale}/login`);
}
