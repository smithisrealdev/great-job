import { redirect } from 'next/navigation';

// The middleware sends signed-out users to login and un-onboarded users to onboarding; everyone else starts at the job list.
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/jobs`);
}
