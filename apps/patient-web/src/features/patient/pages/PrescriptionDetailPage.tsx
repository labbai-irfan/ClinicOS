import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, Download, FileText, Pill } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { QueryBoundary } from '../../../components/QueryBoundary';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { StatusPill } from '../../../components/ui/StatusPill';
import { toast } from '../../../components/ui/Toast';
import { usePrescriptionQuery, downloadPrescriptionPDF } from '../api';

export default function PrescriptionDetailPage() {
  const navigate = useNavigate();
  const { prescriptionId } = useParams<{ prescriptionId: string }>();
  const prescriptionQuery = usePrescriptionQuery(prescriptionId || '');
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!prescriptionId) return;
    setIsDownloading(true);
    try {
      const { data } = await downloadPrescriptionPDF(prescriptionId);
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `prescription-${prescriptionId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      toast.success('Prescription downloaded');
    } catch {
      toast.error('Failed to download prescription');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!prescriptionId) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/prescriptions')}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Prescriptions
        </Button>
        <ErrorState onRetry={() => navigate('/prescriptions')} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/prescriptions')}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Button>
      </div>

      <QueryBoundary
        isLoading={prescriptionQuery.isLoading}
        isError={prescriptionQuery.isError}
        data={prescriptionQuery.data}
        onRetry={() => prescriptionQuery.refetch()}
        loadingFallback={<PrescriptionDetailSkeleton />}
      >
        {(prescription) => (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <PageHeader
                  title="Prescription Details"
                  description={`From ${prescription.doctorName || 'Dr. ' + prescription.doctorId}`}
                />
              </div>
              <Button
                onClick={handleDownload}
                disabled={isDownloading}
                loading={isDownloading}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Download PDF
              </Button>
            </div>

            <Card className="p-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-text-secondary">Doctor</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">
                    {prescription.doctorName || 'Dr. ' + prescription.doctorId}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-text-secondary">Issued Date</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">
                    {format(parseISO(prescription.date), 'MMMM d, yyyy')}
                  </p>
                </div>
                {prescription.expiryDate && (
                  <div>
                    <p className="text-xs font-medium text-text-secondary">Expiry Date</p>
                    <p className="mt-1 text-lg font-semibold text-text-primary">
                      {format(parseISO(prescription.expiryDate), 'MMMM d, yyyy')}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium text-text-secondary">Status</p>
                  <div className="mt-1">
                    <StatusPill
                      label={prescription.status}
                      tone={
                        prescription.status === 'active'
                          ? 'success'
                          : prescription.status === 'expired'
                            ? 'warning'
                            : 'neutral'
                      }
                    />
                  </div>
                </div>
              </div>

              {prescription.notes && (
                <div className="mt-6 border-t border-border pt-6">
                  <p className="text-sm font-medium text-text-primary">Special Instructions</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">
                    {prescription.notes}
                  </p>
                </div>
              )}
            </Card>

            <div>
              <h2 className="text-lg font-semibold text-text-primary">Medicines</h2>

              {prescription.medicines.length === 0 ? (
                <Card className="mt-4 p-8">
                  <div className="text-center">
                    <Pill className="mx-auto h-12 w-12 text-text-tertiary" aria-hidden="true" />
                    <p className="mt-2 text-sm text-text-secondary">No medicines in this prescription</p>
                  </div>
                </Card>
              ) : (
                <div className="mt-4 space-y-3">
                  {prescription.medicines.map((medicine) => (
                    <Card key={medicine.id} className="p-4">
                      <div className="space-y-2">
                        <h3 className="font-semibold text-text-primary">{medicine.name}</h3>
                        <div className="grid gap-2 text-sm text-text-secondary sm:grid-cols-3">
                          <div>
                            <p className="text-xs font-medium text-text-secondary">Dosage</p>
                            <p className="mt-0.5">{medicine.dosage}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-text-secondary">Frequency</p>
                            <p className="mt-0.5">{medicine.frequency}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-text-secondary">Duration</p>
                            <p className="mt-0.5">{medicine.duration}</p>
                          </div>
                        </div>
                        {medicine.instructions && (
                          <div>
                            <p className="text-xs font-medium text-text-secondary">Instructions</p>
                            <p className="mt-0.5 text-sm text-text-secondary">{medicine.instructions}</p>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}

function PrescriptionDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-32" />
      <Card className="p-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </Card>
    </div>
  );
}
