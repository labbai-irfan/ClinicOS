import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Download, FileText } from 'lucide-react';
import { Button, Card, PageHeader } from '../../../components/ui';
import { QueryBoundary } from '../../../components/QueryBoundary';
import { EmptyState } from '../../../components/ui/EmptyState';
import { StatusPill } from '../../../components/ui/StatusPill';
import { toast } from '../../../components/ui/Toast';
import { useNavigate } from 'react-router-dom';
import { usePatientPrescriptionsQuery, downloadPrescriptionPDF } from '../api';

type PrescriptionFilter = 'all' | 'active' | 'expired' | 'archived';

const TABS = [
  { key: 'active' as const, label: 'Active' },
  { key: 'expired' as const, label: 'Expired' },
  { key: 'archived' as const, label: 'Archived' },
  { key: 'all' as const, label: 'All' },
];

export default function PatientPrescriptionsPage() {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState<PrescriptionFilter>('active');
  const prescriptionsQuery = usePatientPrescriptionsQuery();

  const filteredPrescriptions = useMemo(() => {
    if (!prescriptionsQuery.data) return [];

    let filtered = prescriptionsQuery.data;

    if (selectedTab !== 'all') {
      filtered = filtered.filter((p) => p.status === selectedTab);
    }

    return filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [prescriptionsQuery.data, selectedTab]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Prescriptions"
        description="View and download your prescriptions"
      />

      <div className="flex flex-wrap gap-2 border-b border-border pb-4">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelectedTab(key)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              selectedTab === key
                ? 'border-b-2 border-primary text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <QueryBoundary
        isLoading={prescriptionsQuery.isLoading}
        isError={prescriptionsQuery.isError}
        data={prescriptionsQuery.data}
        onRetry={() => prescriptionsQuery.refetch()}
        loadingFallback={
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-surface-muted" />
            ))}
          </div>
        }
      >
        {() => {
          if (filteredPrescriptions.length === 0) {
            return (
              <Card>
                <div className="p-8">
                  <EmptyState
                    icon={FileText}
                    title={selectedTab === 'active' ? 'No active prescriptions' : 'No prescriptions found'}
                    description={
                      selectedTab === 'active'
                        ? "You don't have any active prescriptions at the moment."
                        : `You don't have any ${selectedTab === 'expired' ? 'expired' : 'archived'} prescriptions.`
                    }
                  />
                </div>
              </Card>
            );
          }

          return (
            <div className="space-y-3">
              {filteredPrescriptions.map((prescription) => (
                <PrescriptionCard
                  key={prescription.id}
                  prescription={prescription}
                  onViewDetails={() => navigate(`/prescriptions/${prescription.id}`)}
                />
              ))}
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

function PrescriptionCard({
  prescription,
  onViewDetails,
}: {
  prescription: any;
  onViewDetails: () => void;
}) {
  const [isDownloading, setIsDownloading] = useState(false);

  const prescriptionDate = parseISO(prescription.date);
  const isExpired = prescription.status === 'expired' || (prescription.expiryDate && new Date(prescription.expiryDate) < new Date());

  const statusTone = prescription.status === 'active' ? 'success' : prescription.status === 'expired' ? 'warning' : 'neutral';

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloading(true);
    try {
      const { data } = await downloadPrescriptionPDF(prescription.id);
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `prescription-${prescription.id}.pdf`);
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

  return (
    <Card className="overflow-hidden hover:bg-surface-hover transition-colors cursor-pointer" onClick={onViewDetails}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 gap-4">
            <div className="mt-1 flex-shrink-0 rounded-lg bg-primary/10 p-2">
              <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-text-primary">
                {prescription.doctorName || 'Dr. Prescription'}
              </h3>
              <div className="mt-1 space-y-1 text-sm text-text-secondary">
                <p>
                  {prescription.medicines.length} medicine{prescription.medicines.length !== 1 ? 's' : ''}
                </p>
                <p>{format(prescriptionDate, 'MMMM d, yyyy')}</p>
                {prescription.expiryDate && (
                  <p>Expires: {format(parseISO(prescription.expiryDate), 'MMMM d, yyyy')}</p>
                )}
              </div>
              {prescription.medicines.length > 0 && (
                <div className="mt-2 text-xs text-text-secondary">
                  <p className="font-medium">Medicines:</p>
                  <ul className="mt-1 space-y-0.5">
                    {prescription.medicines.slice(0, 2).map((medicine: any, index: number) => (
                      <li key={index}>
                        {medicine.name} - {medicine.dosage} - {medicine.frequency}
                      </li>
                    ))}
                    {prescription.medicines.length > 2 && (
                      <li>+{prescription.medicines.length - 2} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-3">
            <StatusPill label={prescription.status} tone={statusTone} />
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={isDownloading}
              loading={isDownloading}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
