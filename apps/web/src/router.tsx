import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { PERMISSIONS } from '@clinicos/types';
import { AppShell } from './components/shell/AppShell';
import { RequireAuth, PublicOnly } from './components/RequireAuth';
import { PermissionGate } from './components/PermissionGate';
import { SkeletonRows } from './components/ui/Skeleton';

/**
 * Central route registry (spec §9, engineering guide "Web feature anatomy").
 * Every path below is a CONTRACT: feature pages must be created at exactly this
 * file path so the lazy import resolves. Do not create page files elsewhere and
 * do not add routes outside this file.
 */

// Auth (public)
const LoginPage = lazy(() => import('./features/auth/pages/LoginPage'));
const RegisterPage = lazy(() => import('./features/auth/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./features/auth/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./features/auth/pages/ResetPasswordPage'));

// Public waiting-room display (no shell, no auth — spec §17)
const WaitingRoomDisplayPage = lazy(() => import('./features/display/pages/WaitingRoomDisplayPage'));

// Onboarding
const OnboardingPage = lazy(() => import('./features/onboarding/pages/OnboardingPage'));

// Core
const DashboardPage = lazy(() => import('./features/dashboard/pages/DashboardPage'));
const QueueBoardPage = lazy(() => import('./features/queue/pages/QueueBoardPage'));

// Patients
const PatientDirectoryPage = lazy(() => import('./features/patients/pages/PatientDirectoryPage'));
const PatientRegistrationPage = lazy(() => import('./features/patients/pages/PatientRegistrationPage'));
const PatientProfilePage = lazy(() => import('./features/patients/pages/PatientProfilePage'));

// Appointments
const AppointmentsPage = lazy(() => import('./features/appointments/pages/AppointmentsPage'));

// Emergency
const EmergencyBoardPage = lazy(() => import('./features/emergency/pages/EmergencyBoardPage'));
const EmergencyQuickRegistrationPage = lazy(
  () => import('./features/emergency/pages/EmergencyQuickRegistrationPage'),
);
const EmergencyCasePage = lazy(() => import('./features/emergency/pages/EmergencyCasePage'));

// Clinical
const NurseWorklistPage = lazy(() => import('./features/clinical/pages/NurseWorklistPage'));
const NurseAssessmentPage = lazy(() => import('./features/clinical/pages/NurseAssessmentPage'));
const DoctorWorklistPage = lazy(() => import('./features/clinical/pages/DoctorWorklistPage'));
const DoctorConsultationPage = lazy(() => import('./features/clinical/pages/DoctorConsultationPage'));

// Billing
const InvoiceListPage = lazy(() => import('./features/billing/pages/InvoiceListPage'));
const InvoiceDetailPage = lazy(() => import('./features/billing/pages/InvoiceDetailPage'));
const DailyClosingPage = lazy(() => import('./features/billing/pages/DailyClosingPage'));

// Reports
const ReportsPage = lazy(() => import('./features/reports/pages/ReportsPage'));

// Admin
const StaffPage = lazy(() => import('./features/admin/pages/StaffPage'));
const RolesPage = lazy(() => import('./features/admin/pages/RolesPage'));
const SchedulesPage = lazy(() => import('./features/admin/pages/SchedulesPage'));
const ClinicSettingsPage = lazy(() => import('./features/admin/pages/ClinicSettingsPage'));
const AuditLogsPage = lazy(() => import('./features/admin/pages/AuditLogsPage'));

// Notifications / Documents
const NotificationsPage = lazy(() => import('./features/notifications/pages/NotificationsPage'));
const DocumentsPage = lazy(() => import('./features/documents/pages/DocumentsPage'));

function Loading() {
  return (
    <div className="p-6">
      <SkeletonRows rows={6} />
    </div>
  );
}

function withSuspense(node: React.ReactNode) {
  return <Suspense fallback={<Loading />}>{node}</Suspense>;
}

function protectedPage(permission: Parameters<typeof PermissionGate>[0]['permission'], node: React.ReactNode) {
  return withSuspense(<PermissionGate permission={permission}>{node}</PermissionGate>);
}

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },

  { path: '/login', element: <PublicOnly>{withSuspense(<LoginPage />)}</PublicOnly> },
  { path: '/register', element: <PublicOnly>{withSuspense(<RegisterPage />)}</PublicOnly> },
  { path: '/forgot-password', element: <PublicOnly>{withSuspense(<ForgotPasswordPage />)}</PublicOnly> },
  { path: '/reset-password', element: <PublicOnly>{withSuspense(<ResetPasswordPage />)}</PublicOnly> },

  { path: '/display/:branchId', element: withSuspense(<WaitingRoomDisplayPage />) },

  {
    path: '/onboarding',
    element: <RequireAuth>{withSuspense(<OnboardingPage />)}</RequireAuth>,
  },

  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { path: '/dashboard', element: protectedPage(PERMISSIONS.DASHBOARD_VIEW, <DashboardPage />) },
      { path: '/queue', element: protectedPage(PERMISSIONS.QUEUE_READ, <QueueBoardPage />) },

      { path: '/patients', element: protectedPage(PERMISSIONS.PATIENT_READ_BASIC, <PatientDirectoryPage />) },
      {
        path: '/patients/new',
        element: protectedPage(PERMISSIONS.PATIENT_CREATE, <PatientRegistrationPage />),
      },
      {
        path: '/patients/:patientId',
        element: protectedPage(PERMISSIONS.PATIENT_READ_BASIC, <PatientProfilePage />),
      },

      { path: '/appointments', element: protectedPage(PERMISSIONS.APPOINTMENT_READ, <AppointmentsPage />) },

      { path: '/emergency', element: protectedPage(PERMISSIONS.EMERGENCY_READ, <EmergencyBoardPage />) },
      {
        path: '/emergency/new',
        element: protectedPage(PERMISSIONS.EMERGENCY_CREATE, <EmergencyQuickRegistrationPage />),
      },
      {
        path: '/emergency/:caseId',
        element: protectedPage(PERMISSIONS.EMERGENCY_READ, <EmergencyCasePage />),
      },

      {
        path: '/clinical/nurse',
        element: protectedPage(PERMISSIONS.ASSESSMENT_CREATE, <NurseWorklistPage />),
      },
      {
        path: '/clinical/nurse/:queueEntryId',
        element: protectedPage(PERMISSIONS.ASSESSMENT_CREATE, <NurseAssessmentPage />),
      },
      {
        path: '/clinical/doctor',
        element: protectedPage(PERMISSIONS.CONSULTATION_CREATE, <DoctorWorklistPage />),
      },
      {
        path: '/clinical/doctor/:queueEntryId',
        element: protectedPage(PERMISSIONS.CONSULTATION_CREATE, <DoctorConsultationPage />),
      },

      { path: '/billing', element: protectedPage(PERMISSIONS.BILLING_READ, <InvoiceListPage />) },
      {
        path: '/billing/daily-closing',
        element: protectedPage(PERMISSIONS.BILLING_READ, <DailyClosingPage />),
      },
      { path: '/billing/:invoiceId', element: protectedPage(PERMISSIONS.BILLING_READ, <InvoiceDetailPage />) },

      { path: '/reports', element: protectedPage(PERMISSIONS.REPORTS_VIEW, <ReportsPage />) },

      { path: '/admin/staff', element: protectedPage(PERMISSIONS.STAFF_MANAGE, <StaffPage />) },
      { path: '/admin/roles', element: protectedPage(PERMISSIONS.ROLE_MANAGE, <RolesPage />) },
      { path: '/admin/schedules', element: protectedPage(PERMISSIONS.SCHEDULE_MANAGE, <SchedulesPage />) },
      { path: '/admin/settings', element: protectedPage(PERMISSIONS.SETTINGS_MANAGE, <ClinicSettingsPage />) },
      { path: '/admin/audit-logs', element: protectedPage(PERMISSIONS.AUDIT_VIEW, <AuditLogsPage />) },

      {
        path: '/notifications',
        element: protectedPage(PERMISSIONS.NOTIFICATION_READ, <NotificationsPage />),
      },
      { path: '/documents', element: protectedPage(PERMISSIONS.DOCUMENT_READ, <DocumentsPage />) },
    ],
  },

  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
