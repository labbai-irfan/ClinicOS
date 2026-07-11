import { Plus, Trash2 } from 'lucide-react';
import { WEEKDAYS } from '@clinicos/types';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { WEEKDAY_LABELS } from '../labels';
import type { DoctorScheduleDayDto, DoctorScheduleSessionDto } from '../api';

export interface ScheduleFormValue {
  weekly: DoctorScheduleDayDto[];
  slotMinutes: number;
  bufferMinutes: number;
  maxPerWindow: number;
  walkInCapacityPerDay: number;
}

export const DEFAULT_SCHEDULE_VALUE: ScheduleFormValue = {
  weekly: WEEKDAYS.map((day) => ({ day, sessions: [] })),
  slotMinutes: 20,
  bufferMinutes: 5,
  maxPerWindow: 4,
  walkInCapacityPerDay: 50,
};

const EMPTY_SESSION: DoctorScheduleSessionDto = { start: '09:00', end: '13:00' };

/** Editable weekly session grid + slot/buffer/capacity rules (doctorScheduleSchema shape,
 *  minus doctorId/branchId which the caller already knows). */
export function WeeklyScheduleEditor({
  value,
  onChange,
  disabled,
}: {
  value: ScheduleFormValue;
  onChange: (next: ScheduleFormValue) => void;
  disabled?: boolean;
}) {
  function updateDay(day: string, sessions: DoctorScheduleSessionDto[]) {
    onChange({
      ...value,
      weekly: value.weekly.map((d) => (d.day === day ? { ...d, sessions } : d)),
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Weekly sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {value.weekly.map((entry) => (
            <div key={entry.day} className="rounded border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-text-primary">{WEEKDAY_LABELS[entry.day]}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled || entry.sessions.length >= 4}
                  onClick={() => updateDay(entry.day, [...entry.sessions, { ...EMPTY_SESSION }])}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add session
                </Button>
              </div>
              {entry.sessions.length === 0 ? (
                <p className="text-sm text-text-secondary">Off — no sessions scheduled.</p>
              ) : (
                <div className="space-y-2">
                  {entry.sessions.map((session, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2">
                      <Input
                        type="time"
                        aria-label={`${WEEKDAY_LABELS[entry.day]} session ${index + 1} start`}
                        value={session.start}
                        disabled={disabled}
                        className="w-32"
                        onChange={(e) => {
                          const start = e.target.value;
                          updateDay(
                            entry.day,
                            entry.sessions.map((s, i) => (i === index ? { ...s, start } : s)),
                          );
                        }}
                      />
                      <span className="text-text-secondary">to</span>
                      <Input
                        type="time"
                        aria-label={`${WEEKDAY_LABELS[entry.day]} session ${index + 1} end`}
                        value={session.end}
                        disabled={disabled}
                        className="w-32"
                        onChange={(e) => {
                          const end = e.target.value;
                          updateDay(
                            entry.day,
                            entry.sessions.map((s, i) => (i === index ? { ...s, end } : s)),
                          );
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        onClick={() =>
                          updateDay(
                            entry.day,
                            entry.sessions.filter((_, i) => i !== index),
                          )
                        }
                        aria-label={`Remove ${WEEKDAY_LABELS[entry.day]} session ${index + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Booking rules</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Slot length (minutes)" htmlFor="slotMinutes" hint="5–120 minutes per patient">
            <Input
              id="slotMinutes"
              type="number"
              min={5}
              max={120}
              disabled={disabled}
              value={value.slotMinutes}
              onChange={(e) => onChange({ ...value, slotMinutes: Number(e.target.value) })}
            />
          </Field>
          <Field label="Buffer (minutes)" htmlFor="bufferMinutes" hint="Gap kept between appointments">
            <Input
              id="bufferMinutes"
              type="number"
              min={0}
              max={60}
              disabled={disabled}
              value={value.bufferMinutes}
              onChange={(e) => onChange({ ...value, bufferMinutes: Number(e.target.value) })}
            />
          </Field>
          <Field label="Max per window" htmlFor="maxPerWindow" hint="Appointments allowed per slot">
            <Input
              id="maxPerWindow"
              type="number"
              min={1}
              max={30}
              disabled={disabled}
              value={value.maxPerWindow}
              onChange={(e) => onChange({ ...value, maxPerWindow: Number(e.target.value) })}
            />
          </Field>
          <Field
            label="Walk-in capacity per day"
            htmlFor="walkInCapacityPerDay"
            hint="Maximum walk-ins accepted per day"
          >
            <Input
              id="walkInCapacityPerDay"
              type="number"
              min={0}
              max={500}
              disabled={disabled}
              value={value.walkInCapacityPerDay}
              onChange={(e) => onChange({ ...value, walkInCapacityPerDay: Number(e.target.value) })}
            />
          </Field>
        </CardContent>
      </Card>
    </div>
  );
}
