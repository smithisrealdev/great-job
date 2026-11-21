import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { createServerSupabase } from '@/lib/db/server';
import type { Prefs, ResumeProfile } from '@/lib/types';

const EMPTY_PREFS: Prefs = { roles: [], modes: [], minSalaryThb: null, seniority: null };
const EMPTY_RESUME: ResumeProfile = { skills: [], experience: [], education: [], yearsTotal: 0 };

export const dynamic = 'force-dynamic'; // reads the session cookie

export default async function Profile({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  const { data } = await supabase.from('profiles').select('prefs, resume, profile_version').eq('user_id', user.id).maybeSingle();
  return <ProfileForm key={data?.profile_version} initialPrefs={{ ...EMPTY_PREFS, ...data?.prefs }} initialResume={data?.resume ?? EMPTY_RESUME} />;
}
