import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShellPatient } from './components/shell/AppShell-patient';
import { RequireAuth, PublicOnly } from './components/RequireAuth';
import { SkeletonRows } from './components/ui/Skeleton';

/**
 * Patient web app route registry.
 * Routes available to authenticated patients.
 */

// Auth (public)
const PatientLoginPage = lazy(() => import('./features/auth/pages/LoginPage'));
const PatientRegisterPage = lazy(() => import('./features/auth/pages/RegisterPage'));

// Patient features
const PatientDashboardPage = lazy(() => import('./features/patient/pages/DashboardPage'));
const AppointmentsPage = lazy(() => import('./features/patient/pages/AppointmentsPage'));
const BookAppointmentPage = lazy(() => import('./features/patient/pages/BookAppointmentPage'));
const PrescriptionsPage = lazy(() => import('./features/patient/pages/PrescriptionsPage'));
const PrescriptionDetailPage = lazy(() => import('./features/patient/pages/PrescriptionDetailPage'));
const PatientProfilePage = lazy(() => import('./features/patient/pages/ProfilePage'));

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

export const patientRouter = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },

  { path: '/login', element: <PublicOnly>{withSuspense(<PatientLoginPage />)}</PublicOnly> },
  { path: '/register', element: <PublicOnly>{withSuspense(<PatientRegisterPage />)}</PublicOnly> },

  {
    element: (
      <RequireAuth>
        <AppShellPatient />
      </RequireAuth>
    ),
    children: [
      { path: '/dashboard', element: withSuspense(<PatientDashboardPage />) },
      { path: '/appointments', element: withSuspense(<AppointmentsPage />) },
      { path: '/appointments/new', element: withSuspense(<BookAppointmentPage />) },
      { path: '/book-appointment', element: withSuspense(<BookAppointmentPage />) },
      { path: '/prescriptions', element: withSuspense(<PrescriptionsPage />) },
      { path: '/prescriptions/:prescriptionId', element: withSuspense(<PrescriptionDetailPage />) },
      { path: '/profile', element: withSuspense(<PatientProfilePage />) },
    ],
  },

  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
