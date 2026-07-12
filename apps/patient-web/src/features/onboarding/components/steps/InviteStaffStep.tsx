import { useState } from 'react';
import type { StaffDto } from '@clinicos/types';
import { CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/Card';
import { StaffInviteForm } from '../StaffInviteForm';
import { StepFooter } from '../StepFooter';

interface InviteStaffStepProps {
  branchId: string | null;
  onBack: () => void;
  onComplete: (patch: { staffInvited: number }) => void;
}

export function InviteStaffStep({ branchId, onBack, onComplete }: InviteStaffStepProps) {
  const [count, setCount] = useState(0);

  return (
    <div>
      <CardHeader>
        <div>
          <CardTitle>Invite staff</CardTitle>
          <CardDescription>
            Add nurses, receptionists or admins. You can invite more later from Admin &gt; Staff.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <StaffInviteForm branchId={branchId} onInvited={(_staff: StaffDto) => setCount((c) => c + 1)} />
      </CardContent>
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        <StepFooter onBack={onBack} onContinueClick={() => onComplete({ staffInvited: count })} />
      </div>
    </div>
  );
}
