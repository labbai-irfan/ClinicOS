import { format } from 'date-fns';
import { Clock } from 'lucide-react';

interface TimeSlot {
  windowStart: string;
  windowEnd: string;
  capacity: number;
  bookedCount: number;
  available: boolean;
}

interface TimeSlotPickerProps {
  slots: TimeSlot[];
  selectedSlot?: string;
  onSelectSlot: (windowStart: string) => void;
  isLoading?: boolean;
}

export function TimeSlotPicker({
  slots,
  selectedSlot,
  onSelectSlot,
  isLoading,
}: TimeSlotPickerProps) {
  if (isLoading) {
    return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-muted" />
      ))}
    </div>;
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-muted p-4 text-center">
        <p className="text-sm text-text-secondary">No available slots for this date</p>
      </div>
    );
  }

  const availableSlots = slots.filter((slot) => slot.available);

  if (availableSlots.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-muted p-4 text-center">
        <p className="text-sm text-text-secondary">All slots are booked for this date</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {availableSlots.map((slot) => {
        const isSelected = selectedSlot === slot.windowStart;
        const spotsLeft = slot.capacity - slot.bookedCount;
        const isFull = spotsLeft === 0;

        return (
          <button
            key={slot.windowStart}
            type="button"
            onClick={() => onSelectSlot(slot.windowStart)}
            disabled={isFull}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-3 transition-all ${
              isSelected
                ? 'border-primary bg-primary/10 text-primary'
                : isFull
                  ? 'border-border bg-surface-muted text-text-tertiary opacity-50 cursor-not-allowed'
                  : 'border-border bg-background hover:border-primary hover:bg-primary/5 text-text-primary'
            }`}
          >
            <Clock className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm font-medium">
              {format(new Date(`2000-01-01T${slot.windowStart}`), 'h:mm a')}
            </span>
            <span className="text-xs text-text-secondary">
              {isFull ? 'Full' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
