import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Archive, ChevronDown, Download, File, FileText, Image as ImageIcon, RefreshCw } from 'lucide-react';
import type { DocumentDto } from '@clinicos/types';
import { PERMISSIONS } from '@clinicos/types';
import { Card } from '../../../components/ui/Card';
import { StatusPill } from '../../../components/ui/StatusPill';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { usePermission } from '../../../hooks/use-permission';
import { cn } from '../../../lib/utils';
import { getDocumentDownloadUrl } from '../api';
import { DOCUMENT_CATEGORY_LABELS, DOCUMENT_CATEGORY_TONE } from '../document-labels';
import { formatFileSize } from '../validation';
import { ReplaceDocumentDialog } from './ReplaceDocumentDialog';
import { ArchiveDocumentDialog } from './ArchiveDocumentDialog';

/** Picks a representative icon per spec §26 ("appropriate file-type icon") from the stored mime type. */
function fileTypeIcon(mimeType: string) {
  if (mimeType === 'application/pdf') return FileText;
  if (mimeType.startsWith('image/')) return ImageIcon;
  return File;
}

/**
 * A styled link (not a <button> inside an <a>) to `GET /documents/:id/download` — that endpoint
 * is a 302 redirect to a short-lived signed storage URL, so we link straight to it in a new tab
 * rather than fetching + blobbing it ourselves.
 */
function DownloadLink({ id }: { id: string }) {
  return (
    <a
      href={getDocumentDownloadUrl(id)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-9 min-h-[36px] items-center justify-center gap-2 whitespace-nowrap rounded border border-border bg-transparent px-3 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      Download
    </a>
  );
}

function DocumentRow({
  doc,
  canManage,
  onReplace,
  onArchive,
}: {
  doc: DocumentDto;
  canManage: boolean;
  onReplace: (doc: DocumentDto) => void;
  onArchive: (doc: DocumentDto) => void;
}) {
  const Icon = fileTypeIcon(doc.mimeType);
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Icon className="mt-0.5 h-8 w-8 shrink-0 text-text-secondary" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate font-medium text-text-primary">{doc.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusPill
                label={DOCUMENT_CATEGORY_LABELS[doc.category]}
                tone={DOCUMENT_CATEGORY_TONE[doc.category]}
              />
              <span className="text-xs text-text-secondary">v{doc.version}</span>
              <span className="text-xs text-text-secondary">{formatFileSize(doc.sizeBytes)}</span>
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              {doc.uploadedByName ?? 'Unknown uploader'} ·{' '}
              {format(parseISO(doc.createdAt), 'dd MMM yyyy, HH:mm')}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <DownloadLink id={doc.id} />
          {!doc.archived && canManage && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => onReplace(doc)}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Replace
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => onArchive(doc)}>
                <Archive className="h-4 w-4" aria-hidden="true" />
                Archive
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Documents are never hard-deleted (spec §26) — archived ones stay visible in a collapsed,
 * togglable section instead of disappearing from the page.
 */
export function DocumentList({ documents }: { documents: DocumentDto[] }) {
  const { has } = usePermission();
  const canManage = has(PERMISSIONS.DOCUMENT_MANAGE);
  const [replaceTarget, setReplaceTarget] = useState<DocumentDto | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<DocumentDto | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);

  const active = documents.filter((d) => !d.archived);
  const archived = documents.filter((d) => d.archived);

  if (documents.length === 0) {
    return (
      <EmptyState title="No documents yet" description="Upload a report, image, or file for this patient." />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {active.length === 0 ? (
          <EmptyState
            title="No active documents"
            description="All documents for this patient have been archived."
          />
        ) : (
          active.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              canManage={canManage}
              onReplace={setReplaceTarget}
              onArchive={setArchiveTarget}
            />
          ))
        )}
      </div>

      {archived.length > 0 && (
        <div className="rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setArchivedOpen((v) => !v)}
            aria-expanded={archivedOpen}
            aria-controls="archived-documents-panel"
            className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm font-medium text-text-primary hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <span className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-text-secondary" aria-hidden="true" />
              Archived documents ({archived.length})
            </span>
            <ChevronDown
              className={cn('h-4 w-4 text-text-secondary transition-transform', archivedOpen && 'rotate-180')}
              aria-hidden="true"
            />
          </button>
          {archivedOpen && (
            <div id="archived-documents-panel" className="space-y-3 border-t border-border p-4">
              {archived.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  canManage={canManage}
                  onReplace={setReplaceTarget}
                  onArchive={setArchiveTarget}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <ReplaceDocumentDialog document={replaceTarget} onClose={() => setReplaceTarget(null)} />
      <ArchiveDocumentDialog document={archiveTarget} onClose={() => setArchiveTarget(null)} />
    </div>
  );
}
