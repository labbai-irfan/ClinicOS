import { DEFAULTS } from '@clinicos/config';

const ALLOWED_MIME_TYPES: readonly string[] = DEFAULTS.ALLOWED_UPLOAD_MIME;
const MAX_BYTES = DEFAULTS.MAX_UPLOAD_MB * 1024 * 1024;

const MIME_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
};

export const ALLOWED_FILE_TYPES_LABEL = ALLOWED_MIME_TYPES.map((mime) => MIME_LABELS[mime] ?? mime).join(', ');

/**
 * Client-side pre-check mirroring the API's multer fileFilter + size limit (spec §26) so the
 * user gets instant feedback instead of waiting on a round trip that is destined to fail.
 * Still non-authoritative — the server re-validates every upload.
 */
export function validateDocumentFile(file: File): string | undefined {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return `Unsupported file type. Allowed: ${ALLOWED_FILE_TYPES_LABEL}.`;
  }
  if (file.size > MAX_BYTES) {
    return `File exceeds the ${DEFAULTS.MAX_UPLOAD_MB}MB limit.`;
  }
  return undefined;
}

/** Human-readable file size, e.g. "482 KB" or "3.1 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
