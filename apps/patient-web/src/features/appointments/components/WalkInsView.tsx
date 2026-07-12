import { useNavigate } from 'react-router-dom';
import { Footprints } from 'lucide-react';
import { Button, Card, CardContent } from '../../../components/ui';

/** Walk-ins aren't booked here — they're added straight to the live queue (spec §14/§15). */
export function WalkInsView() {
  const navigate = useNavigate();

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <Footprints className="h-10 w-10 text-text-secondary" aria-hidden="true" />
        <div>
          <p className="font-medium text-text-primary">Walk-ins are created from the Queue</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-text-secondary">
            Walk-in patients don&apos;t need an appointment window. Add them straight to today&apos;s
            live queue and reception will check them in from there. This tab tracks booked
            appointments only.
          </p>
        </div>
        <Button type="button" onClick={() => navigate('/queue')}>
          Go to Live Queue
        </Button>
      </CardContent>
    </Card>
  );
}
