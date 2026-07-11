import type { PatientDto, QueueEntryDto } from '@clinicos/types';
import { computeAge } from '@clinicos/config';
import { Card, CardContent } from '../../../components/ui/Card';
import { StatusPill } from '../../../components/ui/StatusPill';
import { Skeleton } from '../../../components/ui/Skeleton';
import { alertTone, genderLabel } from '../utils';

function SummaryList({ label, values, tone }: { label: string; values: string[]; tone?: 'danger' }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">{label}</p>
      {values.length === 0 ? (
        <p className="text-sm text-text-secondary">None recorded</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value, i) => (
            <span
              key={`${value}-${i}`}
              className={
                tone === 'danger'
                  ? 'rounded-full border border-danger/30 bg-danger/10 px-2.5 py-1 text-xs text-danger'
                  : 'rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs text-text-primary'
              }
            >
              {value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Sticky left column on the doctor consultation page: identity, alerts, allergies, conditions, medicines. */
export function PatientSummaryPanel({
  patient,
  entry,
}: {
  patient: PatientDto | undefined;
  entry: QueueEntryDto;
}) {
  if (!patient) {
    return (
      <Card>
        <CardContent className="space-y-3 pt-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const age = computeAge(patient.dateOfBirth, patient.approximateAge);
  const alerts = entry.alerts && entry.alerts.length > 0 ? entry.alerts : patient.alerts;

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{patient.fullName}</h2>
          <p className="text-sm text-text-secondary">
            {patient.code} · {age !== undefined ? `${age} yrs` : 'Age unknown'} · {genderLabel(patient.gender)}
          </p>
          {patient.mobile && <p className="text-sm text-text-secondary">{patient.mobile}</p>}
        </div>

        {alerts.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Alerts</p>
            <div className="flex flex-col gap-1.5">
              {alerts.map((alert, i) => (
                <StatusPill key={i} label={alert.label} tone={alertTone(alert.severity)} />
              ))}
            </div>
          </div>
        )}

        <SummaryList label="Allergies" values={patient.allergies} tone="danger" />
        <SummaryList label="Conditions" values={patient.conditions} />
        <SummaryList label="Current medicines" values={patient.currentMedicines} />
      </CardContent>
    </Card>
  );
}
