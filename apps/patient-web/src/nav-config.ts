import {
  LayoutDashboard,
  ListOrdered,
  MonitorPlay,
  Users,
  CalendarDays,
  Siren,
  Stethoscope,
  ClipboardPlus,
  Receipt,
  BarChart3,
  Settings,
  ShieldCheck,
  ScrollText,
  Bell,
  type LucideIcon,
} from 'lucide-react';
import { PERMISSIONS, type Permission } from '@clinicos/types';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  permission?: Permission;
  children?: Omit<NavItem, 'icon' | 'children'>[];
}

/**
 * Role-aware navigation (spec §9). Every entry declares the permission required to
 * see it — the sidebar filters by `usePermission()` so staff never see, then get
 * blocked from, a module they cannot open.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
  {
    label: 'Live Queue',
    to: '/queue',
    icon: ListOrdered,
    permission: PERMISSIONS.QUEUE_READ,
  },
  {
    label: 'Waiting-Room Display',
    to: '/display',
    icon: MonitorPlay,
    permission: PERMISSIONS.QUEUE_READ,
  },
  {
    label: 'Patients',
    to: '/patients',
    icon: Users,
    permission: PERMISSIONS.PATIENT_READ_BASIC,
    children: [
      { label: 'Patient Directory', to: '/patients' },
      { label: 'New Registration', to: '/patients/new', permission: PERMISSIONS.PATIENT_CREATE },
    ],
  },
  {
    label: 'Appointments',
    to: '/appointments',
    icon: CalendarDays,
    permission: PERMISSIONS.APPOINTMENT_READ,
  },
  {
    label: 'Emergency',
    to: '/emergency',
    icon: Siren,
    permission: PERMISSIONS.EMERGENCY_READ,
    children: [
      { label: 'Emergency Board', to: '/emergency' },
      { label: 'Quick Registration', to: '/emergency/new', permission: PERMISSIONS.EMERGENCY_CREATE },
    ],
  },
  {
    label: 'Nurse Workspace',
    to: '/clinical/nurse',
    icon: ClipboardPlus,
    permission: PERMISSIONS.ASSESSMENT_CREATE,
  },
  {
    label: 'Doctor Workspace',
    to: '/clinical/doctor',
    icon: Stethoscope,
    permission: PERMISSIONS.CONSULTATION_CREATE,
  },
  {
    label: 'Billing',
    to: '/billing',
    icon: Receipt,
    permission: PERMISSIONS.BILLING_READ,
    children: [
      { label: 'Invoices', to: '/billing' },
      { label: 'Daily Closing', to: '/billing/daily-closing' },
    ],
  },
  {
    label: 'Reports',
    to: '/reports',
    icon: BarChart3,
    permission: PERMISSIONS.REPORTS_VIEW,
  },
  {
    label: 'Administration',
    to: '/admin/staff',
    icon: Settings,
    permission: PERMISSIONS.STAFF_MANAGE,
    children: [
      { label: 'Staff', to: '/admin/staff' },
      { label: 'Roles & Permissions', to: '/admin/roles', permission: PERMISSIONS.ROLE_MANAGE },
      { label: 'Doctor Schedules', to: '/admin/schedules', permission: PERMISSIONS.SCHEDULE_MANAGE },
      { label: 'Clinic Settings', to: '/admin/settings', permission: PERMISSIONS.SETTINGS_MANAGE },
    ],
  },
  { label: 'Audit Logs', to: '/admin/audit-logs', icon: ShieldCheck, permission: PERMISSIONS.AUDIT_VIEW },
  { label: 'Notifications', to: '/notifications', icon: Bell, permission: PERMISSIONS.NOTIFICATION_READ },
  { label: 'Documents', to: '/documents', icon: ScrollText, permission: PERMISSIONS.DOCUMENT_READ },
];
