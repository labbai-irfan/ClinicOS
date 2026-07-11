import type { DocumentDto } from '@clinicos/types';
import { Dialog, DialogContent } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import { useArchiveDocumentMutation } from '../api';

/** Confirms an archive action — documents are never hard-deleted, only moved out of the active list. */
export function ArchiveDocumentDialog({
  document,
  onClose,
}: {
  document: DocumentDto | null;
  onClose: () => void;
}) {
  const archiveMutation = useArchiveDocumentMutation();

  const confirm = async () => {
    if (!document) return;
    try {
      await archiveMutation.mutateAsync(document.id);
      toast.success('Document archived', `"${document.title}" was moved to the archived section.`);
      onClose();
    } catch (err) {
      toast.error('Could not archive document', apiErrorMessage(err));
    }
  };

  return (
    <Dialog open={!!document} onOpenChange={(next) => !next && onClose()}>
      {document && (
        <DialogContent
          title="Archive document"
          description={`"${document.title}" will move to the archived section. It is kept, not deleted, and can still be downloaded.`}
        >
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" variant="danger" loading={archiveMutation.isPending} onClick={confirm}>
              Archive
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
