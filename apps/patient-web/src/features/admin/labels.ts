import type { Permission, RoleKey, Weekday } from '@clinicos/types';

/** Display labels for every role key (spec §9 roles). */
export const ROLE_LABELS: Record<RoleKey, string> = {
  super_admin: 'Super admin',
  clinic_owner: 'Clinic owner',
  clinic_admin: 'Clinic admin',
  doctor: 'Doctor',
  nurse: 'Nurse',
  receptionist: 'Receptionist',
  patient: 'Patient',
};

/** Roles a clinic admin can invite/manage — platform ops and the patient portal role excluded. */
export const CLINIC_ROLE_KEYS: readonly RoleKey[] = [
  'clinic_owner',
  'clinic_admin',
  'doctor',
  'nurse',
  'receptionist',
];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export const WEEKDAY_SHORT_LABELS: Record<Weekday, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

const PERMISSION_GROUP_LABELS: Record<string, string> = {
  patient: 'Patients',
  appointment: 'Appointments',
  queue: 'Queue',
  vitals: 'Vitals',
  assessment: 'Nurse assessment',
  consultation: 'Consultation',
  prescription: 'Prescriptions',
  emergency: 'Emergency',
  billing: 'Billing',
  document: 'Documents',
  staff: 'Staff',
  schedule: 'Schedules',
  role: 'Roles',
  reports: 'Reports',
  settings: 'Settings',
  audit: 'Audit',
  onboarding: 'Onboarding',
  notification: 'Notifications',
  dashboard: 'Dashboard',
};

/** First dot-separated segment of a permission key, e.g. `patient.read.basic` -> `patient`. */
export function permissionGroupKey(permission: Permission): string {
  return permission.split('.')[0] ?? permission;
}

export function permissionGroupLabel(group: string): string {
  return PERMISSION_GROUP_LABELS[group] ?? group.charAt(0).toUpperCase() + group.slice(1);
}

/** Human label for the remainder of a permission key, e.g. `patient.read.basic` -> "Read basic". */
export function permissionActionLabel(permission: Permission): string {
  const words = permission.split('.').slice(1).join(' ').replace(/_/g, ' ');
  const label = words || permission;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Groups a permission list by `permissionGroupKey`, preserving first-seen order. */
export function groupPermissions<T extends Permission>(permissions: readonly T[]): Array<[string, T[]]> {
  const order: string[] = [];
  const byGroup = new Map<string, T[]>();
  for (const permission of permissions) {
    const group = permissionGroupKey(permission);
    if (!byGroup.has(group)) {
      byGroup.set(group, []);
      order.push(group);
    }
    byGroup.get(group)!.push(permission);
  }
  return order.map((group) => [group, byGroup.get(group)!]);
}
