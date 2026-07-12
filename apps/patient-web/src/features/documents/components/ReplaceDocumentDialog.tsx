import { useEffect, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import type { DocumentDto, DocumentCategory } from '@clinicos/types';
import { DOCUMENT_CATEGORIES } from '@clinicos/types';
import { documentUploadSchema } from '@clinicos/validation';
import { DEFAULTS } from '@clinicos/config';
import { Dialog, DialogContent } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/Select';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import { useReplaceDocumentMutation, isDocumentStorageUnavailable } from '../api';
import { DOCUMENT_CATEGORY_LABELS } from '../document-labels';
import { ALLOWED_FILE_TYPES_LABEL, validateDocumentFile } from '../validation';

const replaceFormSchema = documentUploadSchema.pick({ category: true, title: true });
type ReplaceFormValues = z.infer<typeof replaceFormSchema>;

export function ReplaceDocumentDialog({
  document,
  onClose,
}: {
  document: DocumentDto | null;
  onClose: () => void;
}) {
  const replaceMutation = useReplaceDocumentMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [progress, setProgress] = useState<number | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReplaceFormValues>({
    resolver: zodResolver(replaceFormSchema),
    defaultValues: { category: 'other', title: '' },
  });

  useEffect(() => {
    if (document) reset({ category: document.category, title: document.title });
    setSelectedFile(null);
    setFileError(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [document, reset]);

  const close = () => {
    setSelectedFile(null);
    setFileError(undefined);
    onClose();
  };

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      setFileError(undefined);
      return;
    }
    const error = validateDocumentFile(file);
    setFileError(error);
    setSelectedFile(error ? null : file);
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!document) return;
    if (!selectedFile) {
      setFileError('A file is required.');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('patientId', document.patientId);
    formData.append('category', values.category);
    formData.append('title', values.title);

    setProgress(0);
    try {
      await replaceMutation.mutateAsync({ id: document.id, formData, onUploadProgress: setProgress });
      toast.success('Document replaced', `A new version of "${values.title}" was uploaded.`);
      close();
    } catch (err) {
      if (isDocumentStorageUnavailable(err)) {
        toast.error(
          'Document storage not configured',
          'Ask an administrator to connect document storage before uploading files.',
        );
      } else {
        toast.error('Replace failed', apiErrorMessage(err));
      }
    } finally {
      setProgress(null);
    }
  });

  return (
    <Dialog open={!!document} onOpenChange={(next) => !next && close()}>
      {document && (
        <DialogContent
          title="Replace document"
          description={`Upload a new version of "${document.title}". The previous version (v${document.version}) is kept, not deleted.`}
        >
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="replace-category" required error={errors.category?.message}>
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => field.onChange(v as DocumentCategory)}>
                      <SelectTrigger id="replace-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {DOCUMENT_CATEGORY_LABELS[category]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Title" htmlFor="replace-title" required error={errors.title?.message}>
                <Input id="replace-title" invalid={!!errors.title} {...register('title')} />
              </Field>
            </div>

            <Field
              label="New file"
              htmlFor="replace-file"
              required
              hint={`${ALLOWED_FILE_TYPES_LABEL}, up to ${DEFAULTS.MAX_UPLOAD_MB}MB`}
              error={fileError}
            >
              <input
                ref={fileInputRef}
                id="replace-file"
                type="file"
                accept={DEFAULTS.ALLOWED_UPLOAD_MIME.join(',')}
                onChange={handleFileChange}
                className="block w-full text-sm text-text-primary file:mr-3 file:min-h-[44px] file:rounded file:border-0 file:bg-surface-muted file:px-4 file:text-sm file:font-medium file:text-text-primary hover:file:bg-border/60"
              />
            </Field>

            {progress !== null && (
              <div className="space-y-1">
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Upload progress"
                >
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-text-secondary">Uploading… {progress}%</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting || replaceMutation.isPending}>
                Upload new version
              </Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
