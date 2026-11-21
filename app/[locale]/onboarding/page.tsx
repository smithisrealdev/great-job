import { setRequestLocale } from 'next-intl/server';
import { OnboardingForm } from '@/components/profile/OnboardingForm';

export default async function Onboarding({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <OnboardingForm />;
}
