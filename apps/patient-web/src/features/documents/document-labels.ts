import type { DocumentCategory } from '@clinicos/types';
import type { StatusTone } from '../../components/ui/StatusPill';

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  lab_report: 'Lab Report',
  imaging: 'Imaging',
  previous_prescription: 'Previous Prescription',
  referral: 'Referral',
  identity: 'Identity',
  consent: 'Consent',
  other: 'Other',
};

/** StatusPill never relies on color alone — the tone is always paired with the label text. */
export const DOCUMENT_CATEGORY_TONE: Record<DocumentCategory, StatusTone> = {
  lab_report: 'info',
  imaging: 'info',
  previous_prescription: 'neutral',
  referral: 'warning',
  identity: 'neutral',
  consent: 'neutral',
  other: 'neutral',
};
