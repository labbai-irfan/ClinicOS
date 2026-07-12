import { useEffect, useMemo, useState } from 'react';
import { CalendarOff, Save, Stethoscope, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { PERMISSIONS } from '@clinicos/types';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/Select';
import { QueryBoundary } from '../../../components/QueryBoundary';
import { usePermission } from '../../../hooks/use-permission';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import {
  doctorScheduleSchema,
  useBranchesQuery,
  useDeleteDoctorLeaveMutation,
  useDoctorLeavesQuery,
  useDoctorScheduleQuery,
  useSaveDoctorScheduleMutation,
  useStaffQuery,
} from '../api';
import {
  DEFAULT_SCHEDULE_VALUE,
  WeeklyScheduleEditor,
  type ScheduleFormValue,
} from '../components/WeeklyScheduleEditor';
import { AddLeaveDialog } from '../components/AddLeaveDialog';

export default function SchedulesPage() {
  const { has } = usePermission();
  const canManage = has(PERMISSIONS.SCHEDULE_MANAGE);

  const { data: doctorsResult, isLoading: doctorsLoading, isError: doctorsError, refetch: refetchDoctors } =
    useStaffQuery({ roleKey: 'doctor', isActive: true, limit: 100 });
  const doctors = doctorsResult?.items ?? [];
  const { data: branches } = useBranchesQuery();
  const branchNameById = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const [doctorId, setDoctorId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  useEffect(() => {
    if (!doctorId && doctors[0]) setDoctorId(doctors[0].id);
  }, [doctors, doctorId]);

  const selectedDoctor = doctors.find((d) => d.id === doctorId);
  const doctorBranches = (selectedDoctor?.branchIds ?? []).map((id) => ({
    id,
    name: branchNameById.get(id) ?? id,
  }));

  useEffect(() => {
    if (selectedDoctor && !selectedDoctor.branchIds.includes(branchId)) {
      setBranchId(selectedDoctor.branchIds[0] ?? '');
    }
  }, [selectedDoctor, branchId]);

  const scheduleQuery = useDoctorScheduleQuery(doctorId || undefined, branchId || undefined);
  const saveSchedule = useSaveDoctorScheduleMutation();

  const [formValue, setFormValue] = useState<ScheduleFormValue>(DEFAULT_SCHEDULE_VALUE);

  useEffect(() => {
    if (!doctorId || !branchId) return;
    if (scheduleQuery.data) {
      setFormValue({
        weekly: DEFAULT_SCHEDULE_VALUE.weekly.map(
          (d) => scheduleQuery.data!.weekly.find((w) => w.day === d.day) ?? d,
        ),
        slotMinutes: scheduleQuery.data.slotMinutes,
        bufferMinutes: scheduleQuery.data.bufferMinutes,
        maxPerWindow: scheduleQuery.data.maxPerWindow,
        walkInCapacityPerDay: scheduleQuery.data.walkInCapacityPerDay,
      });
    } else if (!scheduleQuery.isLoading) {
      setFormValue(DEFAULT_SCHEDULE_VALUE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleQuery.data, scheduleQuery.isLoading, doctorId, branchId]);

  const leavesQuery = useDoctorLeavesQuery(doctorId || undefined, branchId || undefined);
  const deleteLeave = useDeleteDoctorLeaveMutation();

  function handleSave() {
    if (!doctorId || !branchId) return;
    const parsed = doctorScheduleSchema.safeParse({ doctorId, branchId, ...formValue });
    if (!parsed.success) {
      toast.error('Check the schedule', parsed.error.issues[0]?.message ?? 'Some values are invalid.');
      return;
    }
    saveSchedule.mutate(parsed.data, {
      onSuccess: () => toast.success('Schedule saved'),
      onError: (err) => toast.error('Could not save schedule', apiErrorMessage(err)),
    });
  }

  function formatDate(value: string): string {
    try {
      return format(parseISO(value), 'dd MMM yyyy');
    } catch {
      return value;
    }
  }

  return (
    <div>
      <PageHeader
        title="Doctor Schedules"
        description="Set weekly availability, booking rules, and leave for each doctor."
      />

      <QueryBoundary
        isLoading={doctorsLoading}
        isError={doctorsError}
        data={doctorsResult}
        onRetry={() => void refetchDoctors()}
        isEmpty={(d) => d.items.length === 0}
        emptyTitle="No active doctors yet"
        emptyDescription="Invite a doctor from the Staff page first."
      >
        {() => (
          <>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="w-full sm:max-w-xs">
                <label htmlFor="schedule-doctor" className="mb-1.5 block text-sm font-medium text-text-primary">
                  Doctor
                </label>
                <Select value={doctorId} onValueChange={setDoctorId}>
                  <SelectTrigger id="schedule-doctor">
                    <SelectValue placeholder="Select a doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:max-w-xs">
                <label htmlFor="schedule-branch" className="mb-1.5 block text-sm font-medium text-text-primary">
                  Branch
                </label>
                <Select value={branchId} onValueChange={setBranchId} disabled={doctorBranches.length === 0}>
                  <SelectTrigger id="schedule-branch">
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctorBranches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!doctorId || !branchId ? (
              <EmptyState
                icon={Stethoscope}
                title="Choose a doctor and branch"
                description="Pick a doctor and branch above to view or edit their schedule."
              />
            ) : (
              <QueryBoundary
                isLoading={scheduleQuery.isLoading}
                isError={scheduleQuery.isError}
                data={formValue}
                onRetry={() => void scheduleQuery.refetch()}
              >
                {() => (
                  <div className="space-y-6">
                    <WeeklyScheduleEditor
                      value={formValue}
                      onChange={setFormValue}
                      disabled={!canManage}
                    />

                    {canManage && (
                      <div className="flex justify-end">
                        <Button onClick={handleSave} loading={saveSchedule.isPending}>
                          <Save className="h-4 w-4" aria-hidden="true" />
                          Save schedule
                        </Button>
                      </div>
                    )}

                    <Card>
                      <CardContent className="pt-5">
                        <div className="mb-4 flex items-center justify-between">
                          <h2 className="text-base font-semibold text-text-primary">Leaves</h2>
                          {canManage && (
                            <Button size="sm" variant="outline" onClick={() => setLeaveDialogOpen(true)}>
                              <CalendarOff className="h-3.5 w-3.5" aria-hidden="true" />
                              Add leave
                            </Button>
                          )}
                        </div>

                        <QueryBoundary
                          isLoading={leavesQuery.isLoading}
                          isError={leavesQuery.isError}
                          data={leavesQuery.data}
                          onRetry={() => void leavesQuery.refetch()}
                          isEmpty={(d) => d.length === 0}
                          emptyTitle="No leave scheduled"
                          loadingFallback={<p className="text-sm text-text-secondary">Loading leaves…</p>}
                        >
                          {(leaves) => (
                            <ul className="space-y-2">
                              {leaves.map((leave) => (
                                <li
                                  key={leave.id}
                                  className="flex flex-col gap-2 rounded border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div>
                                    <p className="text-sm font-medium text-text-primary">
                                      {formatDate(leave.from)} – {formatDate(leave.to)}
                                    </p>
                                    {leave.reason && (
                                      <p className="text-sm text-text-secondary">{leave.reason}</p>
                                    )}
                                  </div>
                                  {canManage && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      loading={
                                        deleteLeave.isPending && deleteLeave.variables?.leaveId === leave.id
                                      }
                                      onClick={() =>
                                        deleteLeave.mutate(
                                          { leaveId: leave.id, doctorId },
                                          {
                                            onError: (err) =>
                                              toast.error('Could not remove leave', apiErrorMessage(err)),
                                          },
                                        )
                                      }
                                    >
                                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                      Remove
                                    </Button>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </QueryBoundary>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </QueryBoundary>
            )}
          </>
        )}
      </QueryBoundary>

      {canManage && doctorId && (
        <AddLeaveDialog
          open={leaveDialogOpen}
          onClose={() => setLeaveDialogOpen(false)}
          doctorId={doctorId}
          branchId={branchId || undefined}
        />
      )}
    </div>
  );
}
