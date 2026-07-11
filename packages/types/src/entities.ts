import type {
  AppointmentStatus,
  AppointmentType,
  ArrivalMode,
  BillingItemType,
  ConsultationStatus,
  DocumentCategory,
  EmergencyPriority,
  EmergencyStatus,
  Gender,
  InvoiceStatus,
  NotificationCategory,
  NotificationPriority,
  PatientPresence,
  PaymentMethod,
  PrescriptionStatus,
  QueueEntrySource,
  QueueStatus,
  RoleKey,
  Weekday,
} from './enums';
import type { Permission } from './permissions';

/** Serialized (JSON) DTO shapes returned by the API. Dates are ISO strings. */

export interface TenantRef {
  organizationId: string;
  clinicId: string;
  branchId?: string;
}

export interface AuthUserDto {
  id: string;
  name: string;
  email: string;
  roleKey: RoleKey;
  permissions: Permission[];
  organizationId: string;
  clinicId: string | null;
  branchIds: string[];
  activeBranchId: string | null;
  mustChangePassword?: boolean;
}

export interface LoginResponseDto {
  user: AuthUserDto;
  accessToken: string;
  /** Only present for native/Capacitor clients that cannot rely on the httpOnly cookie. */
  refreshToken?: string;
  onboardingComplete: boolean;
}

export interface ClinicDto {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  timezone: string;
  onboardingStep: number;
  onboardingComplete: boolean;
  isActive: boolean;
}

export interface BranchDto {
  id: string;
  clinicId: string;
  name: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  phone?: string;
  workingHours: Array<{ day: Weekday; open: string; close: string; closed: boolean }>;
  isActive: boolean;
}

export interface StaffDto {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  roleKey: RoleKey;
  branchIds: string[];
  specialization?: string;
  qualification?: string;
  registrationNumber?: string;
  consultationFeePaise?: number;
  followUpFeePaise?: number;
  avgConsultationMinutes?: number;
  isActive: boolean;
}

export interface PatientAlertDto {
  kind: 'allergy' | 'clinical';
  label: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface PatientDto {
  id: string;
  code: string;
  fullName: string;
  gender: Gender;
  dateOfBirth?: string;
  approximateAge?: number;
  mobile?: string;
  alternateContact?: string;
  email?: string;
  addressLine?: string;
  city?: string;
  preferredLanguage?: string;
  emergencyContacts: Array<{ name: string; relation?: string; phone: string }>;
  allergies: string[];
  conditions: string[];
  currentMedicines: string[];
  notes?: string;
  alerts: PatientAlertDto[];
  isTemporary: boolean;
  lastVisitAt?: string;
  nextAppointmentAt?: string;
  createdAt: string;
}

export interface AppointmentDto {
  id: string;
  branchId: string;
  patientId: string;
  patient?: Pick<PatientDto, 'id' | 'code' | 'fullName' | 'gender' | 'mobile'>;
  doctorId: string;
  doctorName?: string;
  date: string;
  windowStart: string;
  windowEnd: string;
  recommendedArrival?: string;
  type: AppointmentType;
  reason?: string;
  status: AppointmentStatus;
  internalNotes?: string;
  patientNotes?: string;
  createdAt: string;
}

export interface QueueEntryDto {
  id: string;
  branchId: string;
  date: string;
  token: string;
  patientId: string;
  patientName?: string;
  patientCode?: string;
  age?: number;
  source: QueueEntrySource;
  doctorId?: string;
  doctorName?: string;
  status: QueueStatus;
  presence: PatientPresence;
  priority: number;
  position: number;
  reasonForVisit?: string;
  alerts?: PatientAlertDto[];
  checkedInAt?: string;
  estimatedWaitMinMinutes?: number;
  estimatedWaitMaxMinutes?: number;
  consultationStartedAt?: string;
  version: number;
  createdAt: string;
}

export interface EmergencyCaseDto {
  id: string;
  caseCode: string;
  branchId: string;
  patientId?: string;
  patientLabel: string;
  approximateAge?: number;
  gender: Gender;
  arrivalAt: string;
  arrivalMode: ArrivalMode;
  mainConcern: string;
  status: EmergencyStatus;
  priority: EmergencyPriority;
  priorityConfirmedBy?: string;
  assignedNurseId?: string;
  assignedNurseName?: string;
  assignedDoctorId?: string;
  assignedDoctorName?: string;
  latestVitalsSummary?: string;
  nextAction?: string;
  createdAt: string;
}

export interface VitalRecordDto {
  id: string;
  patientId: string;
  queueEntryId?: string;
  emergencyCaseId?: string;
  temperatureC?: number;
  systolic?: number;
  diastolic?: number;
  pulseBpm?: number;
  spo2Percent?: number;
  respiratoryRate?: number;
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
  bloodGlucoseMgDl?: number;
  recordedAt: string;
  recordedByName?: string;
}

export interface NurseAssessmentDto {
  id: string;
  patientId: string;
  queueEntryId: string;
  chiefComplaint: string;
  symptoms: string[];
  durationText?: string;
  painLevel?: number;
  relevantHistory?: string;
  allergies: string[];
  conditions: string[];
  currentMedicines: string[];
  previousTreatment?: string;
  nurseNotes?: string;
  status: 'draft' | 'completed';
  startedAt: string;
  completedAt?: string;
}

export interface ConsultationDto {
  id: string;
  patientId: string;
  queueEntryId?: string;
  doctorId: string;
  doctorName?: string;
  symptoms?: string;
  examinationFindings?: string;
  clinicalNotes?: string;
  diagnosis: string[];
  treatmentPlan?: string;
  advice?: string;
  testsOrdered: string[];
  followUpAt?: string;
  status: ConsultationStatus;
  startedAt: string;
  completedAt?: string;
  version: number;
}

export interface PrescriptionItemDto {
  medicineName: string;
  genericName?: string;
  form?: string;
  strength?: string;
  dose: string;
  route?: string;
  frequency: string;
  durationDays?: number;
  timing?: string;
  foodRelation?: 'before_food' | 'after_food' | 'with_food' | 'any';
  instruction?: string;
}

export interface PrescriptionDto {
  id: string;
  consultationId: string;
  patientId: string;
  doctorId: string;
  items: PrescriptionItemDto[];
  advice?: string;
  testsRecommended: string[];
  followUpAt?: string;
  includeDiagnosis: boolean;
  status: PrescriptionStatus;
  versionNumber: number;
  verificationCode?: string;
  finalizedAt?: string;
  createdAt: string;
}

export interface InvoiceItemDto {
  description: string;
  type: BillingItemType;
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
}

export interface InvoiceDto {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName?: string;
  queueEntryId?: string;
  emergencyCaseId?: string;
  items: InvoiceItemDto[];
  subtotalPaise: number;
  discountPaise: number;
  discountReason?: string;
  totalPaise: number;
  paidPaise: number;
  refundedPaise: number;
  status: InvoiceStatus;
  deferred: boolean;
  createdAt: string;
}

export interface PaymentDto {
  id: string;
  invoiceId: string;
  amountPaise: number;
  method: PaymentMethod;
  reference?: string;
  receiptNumber: string;
  receivedByName?: string;
  createdAt: string;
  refunded: boolean;
}

export interface DocumentDto {
  id: string;
  patientId: string;
  category: DocumentCategory;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  uploadedByName?: string;
  createdAt: string;
  archived: boolean;
}

export interface NotificationDto {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body?: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface TimelineEventDto {
  id: string;
  kind:
    | 'registration'
    | 'appointment'
    | 'check_in'
    | 'vitals'
    | 'assessment'
    | 'consultation'
    | 'prescription'
    | 'document'
    | 'referral'
    | 'emergency'
    | 'billing'
    | 'follow_up';
  title: string;
  summary?: string;
  refId?: string;
  occurredAt: string;
}

export interface AuditLogDto {
  id: string;
  userId?: string;
  userName?: string;
  roleKey?: string;
  action: string;
  resource: string;
  resourceId?: string;
  reason?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  createdAt: string;
}

export interface DashboardSummaryDto {
  date: string;
  patientsToday: number;
  currentlyWaiting: number;
  waitingForNurse: number;
  readyForDoctor: number;
  inConsultation: number;
  completedToday: number;
  activeEmergencies: number;
  avgWaitMinutes: number | null;
  revenueTodayPaise: number;
  pendingPaymentsPaise: number;
  collectedByMethodPaise: Partial<Record<PaymentMethod, number>>;
  followUpsDue: number;
}
