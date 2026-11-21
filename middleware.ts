import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intl = createIntlMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const response = intl(request);
  if (response.headers.has('location')) return response; // locale redirect, nothing to guard yet

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = url && key
    ? createServerClient(url, key, {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (list) => list.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
        },
      })
    : null;
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  const [, locale, ...rest] = request.nextUrl.pathname.split('/');
  const page = rest[0] ?? '';
  const go = (path: string) => {
    const redirect = NextResponse.redirect(new URL(`/${locale}${path}`, request.url));
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c)); // keep refreshed session cookies
    return redirect;
  };

  if (!user) return page === 'login' ? response : go('/login');
  if (page === 'onboarding') return response;
  const { data: profile } = await supabase!.from('profiles').select('onboarded_at').eq('user_id', user.id).maybeSingle();
  return profile?.onboarded_at ? response : go('/onboarding');
}

// `auth` (OAuth/magic-link callback) lives outside the locale prefix, so it bypasses next-intl.
export const config = { matcher: ['/((?!api|auth|_next|_vercel|.*\\..*).*)'] };
