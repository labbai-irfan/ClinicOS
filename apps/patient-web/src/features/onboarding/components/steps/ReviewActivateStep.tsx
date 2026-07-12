import { CheckCircle2 } from 'lucide-react';
import { formatMoney } from '@clinicos/config';
import { CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { apiErrorMessage } from '../../../../lib/api-client';
import { useActivateClinicMutation, type ClinicRecord } from '../../api';
import type { WizardSummary } from '../../wizard-types';
import { StepFooter } from '../StepFooter';

const REJOIN_POLICY_LABELS: Record<string, string> = {
  after_next_patient: 'After the next patient',
  after_two_patients: 'After two patients',
  end_of_priority_group: 'End of the priority group',
  manual: 'Manual (staff decides)',
};

const WEEKDAY_SHORT: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

interface ReviewActivateStepProps {
  clinic: ClinicRecord | undefined;
  summary: WizardSummary;
  onBack: () => void;
  onActivated: (clinic: ClinicRecord) => void;
}

export function ReviewActivateStep({ clinic, summary, onBack, onActivated }: ReviewActivateStepProps) {
  const activateClinic = useActivateClinicMutation();

  const identity = summary.identity ?? (clinic ? { name: clinic.name, phone: clinic.phone, email: clinic.email, timezone: clinic.timezone } : undefined);

  async function handleActivate() {
    try {
      const result = await activateClinic.mutateAsync();
      onActivated(result);
    } catch {
      // Surfaced inline below via `activateClinic.isError` / `activateClinic.error`.
    }
  }

  return (
    <div>
      <CardHeader>
        <div>
          <CardTitle>Review &amp; activate</CardTitle>
          <CardDescription>Check everything below, then go live.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <SummaryRow label="Clinic name" value={identity?.name} />
          <SummaryRow label="Timezone" value={identity?.timezone} />
          <SummaryRow label="Phone" value={identity?.phone} />
          <SummaryRow label="Email" value={identity?.email} />
          <SummaryRow label="Branch address" value={formatAddress(summary)} />
          <SummaryRow label="Working days" value={formatWorkingHours(summary)} />
          <SummaryRow label="Doctors added" value={String(summary.doctorsInvited ?? 0)} />
          <SummaryRow
            label="Default consultation fee"
            value={
              summary.consultationFeePaise !== undefined ? formatMoney(summary.consultationFeePaise) : undefined
            }
          />
          <SummaryRow
            label="Appointment window"
            value={
              summary.appointmentWindowMinutes !== undefined
                ? `${summary.appointmentWindowMinutes} min (+${summary.appointmentBufferMinutes ?? 0} min buffer)`
                : undefined
            }
          />
          <SummaryRow
            label="Rejoin policy"
            value={summary.rejoinPolicy ? REJOIN_POLICY_LABELS[summary.rejoinPolicy] : undefined}
          />
          <SummaryRow label="Prescription branding" value={summary.prescriptionHeader ? 'Set' : 'Not set'} />
          <SummaryRow label="Staff invited" value={String(summary.staffInvited ?? 0)} />
        </dl>

        <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
          <p className="text-sm text-text-primary">
            Once activated, your clinic dashboard, queue and appointment booking go live for your team.
          </p>
        </div>

        {activateClinic.isError && (
          <p role="alert" className="text-sm text-danger">
            {apiErrorMessage(activateClinic.error, 'Could not activate the clinic.')}
          </p>
        )}
      </CardContent>
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        <StepFooter
          onBack={onBack}
          continueLabel="Activate clinic"
          loading={activateClinic.isPending}
          onContinueClick={() => void handleActivate()}
        />
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-text-secondary">{label}</dt>
      <dd className="mt-0.5 text-sm text-text-primary">{value && value.length > 0 ? value : 'Not set'}</dd>
    </div>
  );
}

function formatAddress(summary: WizardSummary): string | undefined {
  const address = summary.address;
  if (!address) return undefined;
  return [address.addressLine1, address.city, address.state].filter(Boolean).join(', ') || address.name;
}

function formatWorkingHours(summary: WizardSummary): string | undefined {
  const hours = summary.workingHours;
  if (!hours) return undefined;
  const open = hours.filter((h) => !h.closed);
  if (open.length === 0) return 'Closed every day';
  return open.map((h) => `${WEEKDAY_SHORT[h.day] ?? h.day} ${h.open}-${h.close}`).join(', ');
}
