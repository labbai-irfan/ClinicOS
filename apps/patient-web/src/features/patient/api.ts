import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiSuccess, AppointmentDto, BranchDto, PatientDto, StaffDto } from '@clinicos/types';
import { patientApiClient } from '../../lib/api-client-patient';

const PATIENT_KEY = 'patient';
const PRESCRIPTIONS_KEY = 'prescriptions';

/** GET /patient/me — get current patient profile */
export function usePatientMeQuery() {
  return useQuery({
    queryKey: [PATIENT_KEY, 'me'],
    queryFn: async () => {
      const { data } = await patientApiClient.get<ApiSuccess<PatientDto>>('/me');
      return data.data;
    },
  });
}

/** GET /patient/appointments/me — get patient's appointments */
export interface PatientAppointmentsParams {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
}

export function usePatientAppointmentsQuery(params?: PatientAppointmentsParams) {
  return useQuery({
    queryKey: [PATIENT_KEY, 'appointments', params],
    queryFn: async () => {
      const { data } = await patientApiClient.get<ApiSuccess<AppointmentDto[]>>('/appointments/me', {
        params,
      });
      return data.data;
    },
  });
}

/** POST /patient/appointments/book — book a new appointment */
export interface BookAppointmentInput {
  doctorId: string;
  branchId: string;
  startTime: string;
  endTime: string;
  reason?: string;
}

export function useBookAppointmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: BookAppointmentInput) => {
      const { data } = await patientApiClient.post<ApiSuccess<AppointmentDto>>(
        '/appointments/book',
        input,
      );
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [PATIENT_KEY, 'appointments'] });
    },
  });
}

/** GET /patient/branches — branches of the patient's own clinic (booking flow) */
export function usePatientBranchesQuery() {
  return useQuery({
    queryKey: [PATIENT_KEY, 'branches'],
    queryFn: async () => {
      const { data } = await patientApiClient.get<ApiSuccess<BranchDto[]>>('/branches');
      return data.data;
    },
  });
}

/** GET /patient/doctors — doctors at a branch of the patient's clinic (booking flow) */
export function usePatientDoctorsQuery(branchId?: string) {
  return useQuery({
    queryKey: [PATIENT_KEY, 'doctors', branchId],
    queryFn: async () => {
      const { data } = await patientApiClient.get<ApiSuccess<StaffDto[]>>('/doctors', {
        params: { branchId, roleKey: 'doctor', isActive: 'true' },
      });
      return data.data;
    },
    enabled: !!branchId,
  });
}

export interface PatientAvailableSlot {
  windowStart: string;
  windowEnd: string;
  capacity: number;
  bookedCount: number;
  available: boolean;
}

/** GET /patient/available-slots — open slots for a doctor/date (booking flow) */
export function usePatientAvailableSlotsQuery(doctorId?: string, date?: string, branchId?: string) {
  return useQuery({
    queryKey: [PATIENT_KEY, 'available-slots', doctorId, date, branchId],
    queryFn: async () => {
      const { data } = await patientApiClient.get<ApiSuccess<PatientAvailableSlot[]>>(
        '/available-slots',
        { params: { doctorId, date, branchId } },
      );
      return data.data;
    },
    enabled: !!doctorId && !!date,
  });
}

/** GET /patient/prescriptions/me — get patient's prescriptions */
export interface PrescriptionDto {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  date: string;
  expiryDate?: string;
  medicines: PrescriptionMedicine[];
  notes?: string;
  status: 'active' | 'expired' | 'archived';
  createdAt: string;
  pdfUrl?: string;
}

export interface PrescriptionMedicine {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface PatientPrescriptionsParams {
  status?: string;
}

export function usePatientPrescriptionsQuery(params?: PatientPrescriptionsParams) {
  return useQuery({
    queryKey: [PRESCRIPTIONS_KEY, 'me', params],
    queryFn: async () => {
      const { data } = await patientApiClient.get<ApiSuccess<PrescriptionDto[]>>(
        '/prescriptions/me',
        { params },
      );
      return data.data;
    },
  });
}

/** GET /patient/prescriptions/:id — get prescription details */
export function usePrescriptionQuery(id: string) {
  return useQuery({
    queryKey: [PRESCRIPTIONS_KEY, id],
    queryFn: async () => {
      const { data } = await patientApiClient.get<ApiSuccess<PrescriptionDto>>(
        `/prescriptions/${id}`,
      );
      return data.data;
    },
    enabled: !!id,
  });
}

/** PATCH /patient/me — update patient profile */
export interface UpdatePatientInput {
  name?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  city?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export function useUpdatePatientMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdatePatientInput) => {
      // Map the portal's form fields onto the backend's patient record shape.
      const body: Record<string, unknown> = {
        fullName: input.name,
        email: input.email,
        mobile: input.phone,
        dateOfBirth: input.dateOfBirth || undefined,
        gender: input.gender || undefined,
        addressLine: input.address,
        city: input.city,
      };
      if (input.emergencyContactName && input.emergencyContactPhone) {
        body.emergencyContacts = [
          {
            name: input.emergencyContactName,
            relation: 'other',
            phone: input.emergencyContactPhone,
          },
        ];
      }
      const { data } = await patientApiClient.patch<ApiSuccess<PatientDto>>('/me', body);
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [PATIENT_KEY] });
    },
  });
}

/** GET /patient/prescriptions/:id/download — download prescription PDF */
export function downloadPrescriptionPDF(id: string) {
  return patientApiClient.get(`/prescriptions/${id}/download`, {
    responseType: 'blob',
  });
}
