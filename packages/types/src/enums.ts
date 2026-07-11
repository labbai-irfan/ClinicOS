export const APPOINTMENT_STATUSES = [
  'scheduled',
  'confirmed',
  'arrival_pending',
  'checked_in',
  'late',
  'completed',
  'cancelled',
  'rescheduled',
  'no_show',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_TYPES = ['new', 'follow_up', 'procedure', 'review'] as const;
export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];

export const QUEUE_STATUSES = [
  'scheduled',
  'arrival_pending',
  'checked_in',
  'waiting_for_nurse',
  'nurse_assessment',
  'ready_for_doctor',
  'waiting_for_doctor',
  'in_consultation',
  'consultation_completed',
  'billing_pending',
  'completed',
  'temporarily_away',
  'skipped',
  'rejoined',
  'delayed',
  'no_show',
  'cancelled',
] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

/** Kanban board columns (operational subset of queue statuses). */
export const QUEUE_BOARD_COLUMNS = [
  'waiting_for_nurse',
  'nurse_assessment',
  'ready_for_doctor',
  'waiting_for_doctor',
  'in_consultation',
  'billing_pending',
  'completed',
] as const;

export const PATIENT_PRESENCE = [
  'present',
  'temporarily_away',
  'called',
  'no_response',
  'skipped',
  'returned',
  'rejoined',
] as const;
export type PatientPresence = (typeof PATIENT_PRESENCE)[number];

export const QUEUE_ENTRY_SOURCES = [
  'appointment',
  'walk_in',
  'quick_entry',
  'follow_up',
  'emergency',
  'phone_booking',
] as const;
export type QueueEntrySource = (typeof QUEUE_ENTRY_SOURCES)[number];

export const REJOIN_POLICIES = [
  'after_next_patient',
  'after_two_patients',
  'end_of_priority_group',
  'manual',
] as const;
export type RejoinPolicy = (typeof REJOIN_POLICIES)[number];

export const EMERGENCY_STATUSES = [
  'awaiting_triage',
  'triage_in_progress',
  'doctor_alerted',
  'doctor_responding',
  'under_assessment',
  'treatment_in_progress',
  'under_observation',
  'referral_required',
  'transfer_arranging',
  'transferred',
  'discharged',
  'follow_up_required',
  'closed',
] as const;
export type EmergencyStatus = (typeof EMERGENCY_STATUSES)[number];

/**
 * Priority labels are clinic-configurable display labels; these are the default keys.
 * Priority is ALWAYS assigned/confirmed by authorized clinical staff — never computed.
 */
export const EMERGENCY_PRIORITIES = ['critical', 'urgent', 'standard', 'unconfirmed'] as const;
export type EmergencyPriority = (typeof EMERGENCY_PRIORITIES)[number];

export const ARRIVAL_MODES = [
  'walk_in',
  'family_vehicle',
  'ambulance',
  'police',
  'referred',
  'other',
] as const;
export type ArrivalMode = (typeof ARRIVAL_MODES)[number];

export const CONSULTATION_STATUSES = ['draft', 'completed', 'amended'] as const;
export type ConsultationStatus = (typeof CONSULTATION_STATUSES)[number];

export const PRESCRIPTION_STATUSES = ['draft', 'finalized', 'superseded'] as const;
export type PrescriptionStatus = (typeof PRESCRIPTION_STATUSES)[number];

export const INVOICE_STATUSES = [
  'draft',
  'unpaid',
  'partially_paid',
  'paid',
  'refunded',
  'waived',
  'cancelled',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = ['cash', 'upi', 'card', 'bank_transfer'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const BILLING_ITEM_TYPES = [
  'consultation',
  'follow_up',
  'procedure',
  'dressing',
  'injection',
  'test',
  'other',
] as const;
export type BillingItemType = (typeof BILLING_ITEM_TYPES)[number];

export const GENDERS = ['male', 'female', 'other', 'unknown'] as const;
export type Gender = (typeof GENDERS)[number];

export const ROLE_KEYS = [
  'super_admin',
  'clinic_owner',
  'clinic_admin',
  'doctor',
  'nurse',
  'receptionist',
  'patient',
] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const NOTIFICATION_CATEGORIES = [
  'queue',
  'emergency',
  'appointment',
  'billing',
  'follow_up',
  'document',
  'system',
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_PRIORITIES = ['low', 'normal', 'high', 'critical'] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

export const DOCUMENT_CATEGORIES = [
  'lab_report',
  'imaging',
  'previous_prescription',
  'referral',
  'identity',
  'consent',
  'other',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];
