import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/db/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const target = next.startsWith('/') && !next.startsWith('//') ? next : '/'; // no open redirect
  if (code) {
    const { error } = await (await createServerSupabase()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${target}`);
  }
  return NextResponse.redirect(`${origin}/login?error=1`);
}
