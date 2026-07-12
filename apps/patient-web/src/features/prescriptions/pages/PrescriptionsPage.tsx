import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';

export default function PrescriptionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Prescriptions"
        description="View your current and past prescriptions"
      />

      <Card>
        <div className="p-6">
          <p className="text-center text-text-secondary">
            You have no prescriptions yet.
          </p>
        </div>
      </Card>
    </div>
  );
}
