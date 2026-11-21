import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { AddJobForm } from '@/components/jobs/AddJobForm';
import { createServerSupabase } from '@/lib/db/server';

export const dynamic = 'force-dynamic'; // reads the session cookie

export default async function NewJob({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { data: { user } } = await (await createServerSupabase()).auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  return <AddJobForm />;
}
