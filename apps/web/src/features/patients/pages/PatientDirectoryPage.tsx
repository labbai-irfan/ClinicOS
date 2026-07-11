import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search, UserPlus, Users, X } from 'lucide-react';
import { PERMISSIONS } from '@clinicos/types';
import type { PatientDto } from '@clinicos/types';
import { computeAge, DEFAULTS } from '@clinicos/config';
import { format, parseISO } from 'date-fns';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card } from '../../../components/ui/Card';
import { QueryBoundary } from '../../../components/QueryBoundary';
import { usePermission } from '../../../hooks/use-permission';
import { usePatientsQuery } from '../api';
import { useDebouncedValue } from '../hooks';

/** True if the search text looks like a phone number rather than a name/code. */
function isPhoneLike(value: string): boolean {
  const digitsOnly = value.replace(/[\s-]/g, '');
  return /^\+?\d{5,15}$/.test(digitsOnly);
}

function genderLabel(gender: PatientDto['gender']): string {
  return gender.charAt(0).toUpperCase() + gender.slice(1);
}

function ageGenderLabel(patient: PatientDto): string {
  const age = computeAge(patient.dateOfBirth, patient.approximateAge);
  return `${age !== undefined ? `${age} yrs` : 'Age unknown'} · ${genderLabel(patient.gender)}`;
}

function lastVisitLabel(patient: PatientDto): string {
  if (!patient.lastVisitAt) return 'No visits yet';
  return format(parseISO(patient.lastVisitAt), 'dd MMM yyyy');
}

export default function PatientDirectoryPage() {
  const navigate = useNavigate();
  const { has } = usePermission();
  const canCreate = has(PERMISSIONS.PATIENT_CREATE);

  const [searchInput, setSearchInput] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [page, setPage] = useState(1);
  const limit = DEFAULTS.PAGE_SIZE;

  const debouncedSearch = useDebouncedValue(searchInput.trim(), 350);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, dateOfBirth]);

  const searchAsMobile = debouncedSearch && isPhoneLike(debouncedSearch);

  const { data, isLoading, isError, refetch } = usePatientsQuery({
    q: debouncedSearch && !searchAsMobile ? debouncedSearch : undefined,
    mobile: searchAsMobile ? debouncedSearch : undefined,
    dateOfBirth: dateOfBirth || undefined,
    page,
    limit,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const hasFilters = Boolean(debouncedSearch || dateOfBirth);

  return (
    <div>
      <PageHeader
        title="Patients"
        description="Search the patient directory or register a new patient."
        actions={
          canCreate ? (
            <Button onClick={() => navigate('/patients/new')}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              New Registration
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
            aria-hidden="true"
          />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, mobile, or code"
            aria-label="Search patients by name, mobile, or code"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="dob-filter" className="text-sm text-text-secondary">
            Date of birth
          </label>
          <Input
            id="dob-filter"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className="w-auto"
          />
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchInput('');
                setDateOfBirth('');
              }}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </Button>
          )}
        </div>
      </div>

      <QueryBoundary
        isLoading={isLoading}
        isError={isError}
        data={data}
        onRetry={() => void refetch()}
        isEmpty={(d) => d.items.length === 0}
        emptyTitle={hasFilters ? 'No patients match your search' : 'No patients registered yet'}
        emptyDescription={
          hasFilters
            ? 'Try a different name, mobile number, or date of birth.'
            : canCreate
              ? 'Register the first patient to get started.'
              : undefined
        }
      >
        {(result) => (
          <>
            {/* Desktop table */}
            <Card className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-text-secondary">
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Age / Gender</th>
                    <th className="px-4 py-3">Mobile</th>
                    <th className="px-4 py-3">Last visit</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((patient) => (
                    <tr
                      key={patient.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open ${patient.fullName}'s profile`}
                      onClick={() => navigate(`/patients/${patient.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') navigate(`/patients/${patient.id}`);
                      }}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      <td className="px-4 py-3 font-mono text-text-secondary">{patient.code}</td>
                      <td className="px-4 py-3 font-medium text-text-primary">{patient.fullName}</td>
                      <td className="px-4 py-3 text-text-secondary">{ageGenderLabel(patient)}</td>
                      <td className="px-4 py-3 text-text-secondary">{patient.mobile ?? '—'}</td>
                      <td className="px-4 py-3 text-text-secondary">{lastVisitLabel(patient)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Mobile stacked cards */}
            <div className="space-y-3 md:hidden">
              {result.items.map((patient) => (
                <Card
                  key={patient.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open ${patient.fullName}'s profile`}
                  onClick={() => navigate(`/patients/${patient.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate(`/patients/${patient.id}`);
                  }}
                  className="cursor-pointer p-4 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-text-primary">{patient.fullName}</p>
                      <p className="text-xs font-mono text-text-secondary">{patient.code}</p>
                    </div>
                    <Users className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-text-secondary">Age / Gender</dt>
                      <dd className="text-text-primary">{ageGenderLabel(patient)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-secondary">Mobile</dt>
                      <dd className="text-text-primary">{patient.mobile ?? '—'}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-text-secondary">Last visit</dt>
                      <dd className="text-text-primary">{lastVisitLabel(patient)}</dd>
                    </div>
                  </dl>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-text-secondary">
                {result.total} patient{result.total === 1 ? '' : 's'} · Page {result.page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
