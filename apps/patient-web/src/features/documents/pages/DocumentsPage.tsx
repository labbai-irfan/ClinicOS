import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileSearch } from 'lucide-react';
import { objectId } from '@clinicos/validation';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { EmptyState } from '../../../components/ui/EmptyState';
import { QueryBoundary } from '../../../components/QueryBoundary';
import { useDocumentsQuery } from '../api';
import { DocumentUploadForm } from '../components/DocumentUploadForm';
import { DocumentList } from '../components/DocumentList';

/**
 * Documents (spec §26). Scoped to a single patient at a time, either via `?patientId=` (the
 * link used from the patient profile page) or, when that's absent, a pragmatic fallback text
 * input — the same pattern used elsewhere (e.g. AddWalkInDialog) until a full patient picker
 * component exists.
 */
export default function DocumentsPage() {
  const [searchParams] = useSearchParams();
  const queryPatientId = searchParams.get('patientId')?.trim() ?? '';
  const [manualPatientId, setManualPatientId] = useState('');

  const patientId = queryPatientId || manualPatientId.trim();
  const isValidPatientId = !!patientId && objectId.safeParse(patientId).success;

  const { data, isLoading, isError, refetch } = useDocumentsQuery(isValidPatientId ? patientId : undefined);

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Upload, review, and manage patient reports, images, and files."
      />

      {!queryPatientId && (
        <Card className="mb-4 p-4">
          <Field
            label="Patient ID"
            htmlFor="documents-patientId"
            hint="Pragmatic fallback: paste the patient's record ID from their profile until documents are linked from a patient picker here."
          >
            <Input
              id="documents-patientId"
              value={manualPatientId}
              onChange={(e) => setManualPatientId(e.target.value)}
              placeholder="Patient record ID"
            />
          </Field>
        </Card>
      )}

      {!patientId ? (
        <EmptyState
          icon={FileSearch}
          title="Choose a patient"
          description="Enter a patient ID above to view and manage their documents."
        />
      ) : !isValidPatientId ? (
        <EmptyState
          icon={FileSearch}
          title="That doesn't look like a valid patient ID"
          description="Patient IDs are the 24-character identifiers shown on a patient's profile."
        />
      ) : (
        <div className="space-y-6">
          <DocumentUploadForm patientId={patientId} />
          <QueryBoundary isLoading={isLoading} isError={isError} data={data} onRetry={() => void refetch()}>
            {(documents) => <DocumentList documents={documents} />}
          </QueryBoundary>
        </div>
      )}
    </div>
  );
}
