import { useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { UploadCloud } from 'lucide-react';
import { DOCUMENT_CATEGORIES, PERMISSIONS } from '@clinicos/types';
import type { DocumentCategory } from '@clinicos/types';
import { documentUploadSchema } from '@clinicos/validation';
import { DEFAULTS } from '@clinicos/config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/Select';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import { usePermission } from '../../../hooks/use-permission';
import { useUploadDocumentMutation, isDocumentStorageUnavailable } from '../api';
import { DOCUMENT_CATEGORY_LABELS } from '../document-labels';
import { ALLOWED_FILE_TYPES_LABEL, validateDocumentFile } from '../validation';

const uploadFormSchema = documentUploadSchema.pick({ category: true, title: true });
type UploadFormValues = z.infer<typeof uploadFormSchema>;

const DEFAULT_VALUES: UploadFormValues = { category: 'other', title: '' };

export function DocumentUploadForm({ patientId }: { patientId: string }) {
  const { has } = usePermission();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [progress, setProgress] = useState<number | null>(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const uploadMutation = useUploadDocumentMutation();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UploadFormValues>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  if (!has(PERMISSIONS.DOCUMENT_UPLOAD)) return null;

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
    if (!selectedFile) {
      setFileError('A file is required.');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('patientId', patientId);
    formData.append('category', values.category);
    formData.append('title', values.title);

    setProgress(0);
    try {
      await uploadMutation.mutateAsync({ formData, onUploadProgress: setProgress });
      toast.success('Document uploaded', `"${values.title}" was uploaded successfully.`);
      reset(DEFAULT_VALUES);
      setSelectedFile(null);
      setFileError(undefined);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setStorageUnavailable(false);
    } catch (err) {
      if (isDocumentStorageUnavailable(err)) {
        setStorageUnavailable(true);
        toast.error(
          'Document storage not configured',
          'Ask an administrator to connect document storage before uploading files.',
        );
      } else {
        toast.error('Upload failed', apiErrorMessage(err));
      }
    } finally {
      setProgress(null);
    }
  });

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Upload document</CardTitle>
          <CardDescription>
            {ALLOWED_FILE_TYPES_LABEL} — up to {DEFAULTS.MAX_UPLOAD_MB}MB.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {storageUnavailable && (
          <div
            className="mb-4 rounded border border-warning/30 bg-warning/10 p-3 text-sm text-warning"
            role="alert"
          >
            Document storage is not yet configured for this clinic. Uploads will fail until an
            administrator connects storage.
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="upload-category" required error={errors.category?.message}>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v as DocumentCategory)}>
                    <SelectTrigger id="upload-category">
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
            <Field label="Title" htmlFor="upload-title" required error={errors.title?.message}>
              <Input
                id="upload-title"
                placeholder="e.g. CBC report, 12 Jul"
                invalid={!!errors.title}
                {...register('title')}
              />
            </Field>
          </div>

          <Field
            label="File"
            htmlFor="upload-file"
            required
            hint={`${ALLOWED_FILE_TYPES_LABEL}, up to ${DEFAULTS.MAX_UPLOAD_MB}MB`}
            error={fileError}
          >
            <input
              ref={fileInputRef}
              id="upload-file"
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

          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting || uploadMutation.isPending}>
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
              Upload
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
