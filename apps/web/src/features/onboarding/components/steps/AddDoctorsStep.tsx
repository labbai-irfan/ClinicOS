import { useState } from 'react';
import type { StaffDto } from '@clinicos/types';
import { CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/Card';
import { StaffInviteForm } from '../StaffInviteForm';
import { StepFooter } from '../StepFooter';

interface AddDoctorsStepProps {
  branchId: string | null;
  onBack: () => void;
  onComplete: (patch: { doctorsInvited: number }) => void;
}

export function AddDoctorsStep({ branchId, onBack, onComplete }: AddDoctorsStepProps) {
  const [count, setCount] = useState(0);

  return (
    <div>
      <CardHeader>
        <div>
          <CardTitle>Add doctors</CardTitle>
          <CardDescription>
            Invite the doctors who will see patients. You can add more later from Admin &gt; Staff.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <StaffInviteForm
          fixedRoleKey="doctor"
          branchId={branchId}
          onInvited={(_staff: StaffDto) => setCount((c) => c + 1)}
        />
      </CardContent>
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        <StepFooter onBack={onBack} onContinueClick={() => onComplete({ doctorsInvited: count })} />
      </div>
    </div>
  );
}
