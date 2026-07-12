import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { IconButton } from '../../../components/ui/Tooltip';
import { cn } from '../../../lib/utils';

/**
 * Editable list of short text tags (allergies, conditions, current medicines).
 * Read-only mode renders the same values as plain chips.
 */
export function TagListEditor({
  label,
  items,
  onChange,
  editable,
  placeholder = 'Add and press Enter',
  emptyText = 'None recorded',
  tone = 'neutral',
  maxLength = 160,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  editable: boolean;
  placeholder?: string;
  emptyText?: string;
  tone?: 'neutral' | 'danger';
  maxLength?: number;
}) {
  const [draft, setDraft] = useState('');

  function addTag() {
    const value = draft.trim();
    if (!value) return;
    if (items.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...items, value.slice(0, maxLength)]);
    setDraft('');
  }

  function removeTag(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  const chipClasses = cn(
    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm',
    tone === 'danger'
      ? 'border-danger/30 bg-danger/10 text-danger'
      : 'border-border bg-surface-muted text-text-primary',
  );

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-text-primary">{label}</p>
      {items.length === 0 && !editable && (
        <p className="text-sm text-text-secondary">{emptyText}</p>
      )}
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className={chipClasses}>
              <span>{item}</span>
              {editable && (
                <IconButton
                  label={`Remove ${item}`}
                  icon={X}
                  className="h-5 w-5 min-h-0 p-0 text-current hover:bg-transparent hover:opacity-70"
                  onClick={() => removeTag(index)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div className="flex gap-2">
          <Input
            value={draft}
            maxLength={maxLength}
            placeholder={placeholder}
            aria-label={`Add ${label.toLowerCase()}`}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
          />
          <Button type="button" variant="outline" size="md" onClick={addTag} aria-label={`Add ${label.toLowerCase()}`}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
