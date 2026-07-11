export interface OnboardingStepMeta {
  id: number;
  title: string;
  description: string;
}

export const ONBOARDING_STEPS: readonly OnboardingStepMeta[] = [
  { id: 1, title: 'Clinic identity', description: 'Name and contact details' },
  { id: 2, title: 'Address & contact', description: 'Where the branch is located' },
  { id: 3, title: 'Working hours', description: 'Days and hours you are open' },
  { id: 4, title: 'Add doctors', description: 'Invite the doctors on your team' },
  { id: 5, title: 'Consultation fees', description: 'Default fee for a visit' },
  { id: 6, title: 'Appointment & queue rules', description: 'Slot length and rejoin policy' },
  { id: 7, title: 'Prescription branding', description: 'Header and footer on printouts' },
  { id: 8, title: 'Invite staff', description: 'Add the rest of your team' },
  { id: 9, title: 'Review & activate', description: 'Confirm and go live' },
];

export const TOTAL_ONBOARDING_STEPS = ONBOARDING_STEPS.length;
