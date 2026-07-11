import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import type { PatientDuplicateCandidateDto } from '../api';

/**
 * Non-blocking possible-match warning (spec §12). Never auto-merges and never
 * blocks submission — it only links off to the existing record for the
 * receptionist to check manually.
 */
export function DuplicateWarningBanner({ candidates }: { candidates: PatientDuplicateCandidateDto[] }) {
  if (candidates.length === 0) return null;

  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/10 p-4"
    >
      <div className="flex items-center gap-2 text-warning">
        <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="text-sm font-medium">Possible existing patient — please check before continuing</p>
      </div>
      <ul className="space-y-1 pl-7 text-sm text-text-primary">
        {candidates.map((candidate) => (
          <li key={candidate.id}>
            <Link
              to={`/patients/${candidate.id}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              {candidate.fullName}
            </Link>{' '}
            <span className="text-text-secondary">
              ({candidate.code}
              {candidate.mobile ? ` · ${candidate.mobile}` : ''})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
