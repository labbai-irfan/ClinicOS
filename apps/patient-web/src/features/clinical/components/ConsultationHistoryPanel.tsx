import type { ConsultationDto, VitalRecordDto } from '@clinicos/types';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { StatusPill } from '../../../components/ui/StatusPill';
import { formatDateOnly } from '../utils';

/** Right column on the doctor consultation page: previous visits/diagnoses and a vitals trend. */
export function ConsultationHistoryPanel({
  history,
  vitalsTrend,
  currentQueueEntryId,
}: {
  history: ConsultationDto[];
  vitalsTrend: VitalRecordDto[];
  currentQueueEntryId: string;
}) {
  const previous = history.filter((c) => c.queueEntryId !== currentQueueEntryId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Previous visits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {previous.length === 0 ? (
            <p className="text-sm text-text-secondary">No previous consultations on record.</p>
          ) : (
            previous.slice(0, 10).map((c) => (
              <div key={c.id} className="rounded border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-text-primary">{formatDateOnly(c.startedAt)}</span>
                  <StatusPill
                    label={c.status === 'amended' ? 'Amended' : 'Completed'}
                    tone={c.status === 'amended' ? 'warning' : 'success'}
                  />
                </div>
                {c.doctorName && <p className="mt-0.5 text-text-secondary">Dr. {c.doctorName}</p>}
                {c.diagnosis.length > 0 && <p className="mt-1 text-text-primary">{c.diagnosis.join(', ')}</p>}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vitals trend</CardTitle>
        </CardHeader>
        <CardContent>
          {vitalsTrend.length === 0 ? (
            <p className="text-sm text-text-secondary">No vitals recorded yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {vitalsTrend.slice(0, 8).map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-2 border-b border-border pb-1.5 last:border-0 last:pb-0"
                >
                  <span className="text-text-secondary">{formatDateOnly(v.recordedAt)}</span>
                  <span className="text-right text-text-primary">
                    {v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic} mmHg` : ''}
                    {v.pulseBpm ? ` · ${v.pulseBpm} bpm` : ''}
                    {v.temperatureC !== undefined ? ` · ${v.temperatureC}°C` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
