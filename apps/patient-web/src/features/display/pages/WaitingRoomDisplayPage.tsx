import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { AlertTriangle, Megaphone, RadioTower } from 'lucide-react';
import { SOCKET_EVENTS, type DisplayState } from '@clinicos/types';
import { connectDisplaySocket } from '../../../lib/realtime';
import { StatusPill } from '../../../components/ui/StatusPill';
import { ErrorState } from '../../../components/ui/ErrorState';

const FALLBACK_DELAY_MESSAGE =
  'Consultations are running a little behind schedule. Thank you for your patience.';

/** Live clock, ticking once a minute — plenty for a waiting-room screen and avoids needless motion. */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * Public, unauthenticated waiting-room television display (spec §17).
 * Rendered outside the app shell at /display/:branchId — no header, no sidebar,
 * no interactivity. Payload comes exclusively from the privacy-safe DisplayState
 * socket event: tokens and room labels only, NEVER patient names, phone numbers,
 * symptoms, or diagnosis.
 */
export default function WaitingRoomDisplayPage() {
  const { branchId } = useParams<{ branchId: string }>();
  const [state, setState] = useState<DisplayState | null>(null);
  const [connected, setConnected] = useState(false);
  const now = useClock();

  useEffect(() => {
    if (!branchId) return;
    const socket = connectDisplaySocket(branchId);

    const handleState = (payload: DisplayState) => setState(payload);
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    socket.on(SOCKET_EVENTS.DISPLAY_STATE, handleState);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off(SOCKET_EVENTS.DISPLAY_STATE, handleState);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.disconnect();
    };
  }, [branchId]);

  if (!branchId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-10">
        <ErrorState
          title="Display not configured"
          description="No branch was specified for this screen. Check the URL configured on this device."
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-text-primary">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-8 py-5 sm:px-12">
        <div className="flex items-center gap-3 text-text-secondary">
          <RadioTower className="h-7 w-7" aria-hidden="true" />
          <span className="text-lg font-semibold uppercase tracking-[0.25em]">Waiting Room</span>
        </div>
        <div className="flex items-center gap-4">
          {!connected && <StatusPill tone="warning" label="Reconnecting…" />}
          <time dateTime={now.toISOString()} className="text-2xl font-semibold tabular-nums text-text-secondary">
            {format(now, 'h:mm a')}
          </time>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden px-8 py-6 sm:px-12 sm:py-8">
        {state?.announcement && (
          <div className="flex shrink-0 items-center gap-4 rounded-xl border border-info/30 bg-info/10 px-6 py-4 text-info">
            <Megaphone className="h-8 w-8 shrink-0" aria-hidden="true" />
            <p className="text-xl font-medium sm:text-2xl">{state.announcement}</p>
          </div>
        )}

        {state?.delayed && (
          <div className="flex shrink-0 items-center gap-4 rounded-xl border border-warning/30 bg-warning/10 px-6 py-4 text-warning">
            <AlertTriangle className="h-8 w-8 shrink-0" aria-hidden="true" />
            <p className="text-xl font-medium sm:text-2xl">{state.delayMessage || FALLBACK_DELAY_MESSAGE}</p>
          </div>
        )}

        {!state ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-text-secondary">
            <RadioTower className="h-16 w-16 animate-pulse" aria-hidden="true" />
            <p className="text-2xl font-medium sm:text-3xl">Connecting to the waiting room display…</p>
          </div>
        ) : (
          <>
            <section className="flex min-h-0 flex-[3] flex-col">
              <h1 className="mb-4 shrink-0 text-2xl font-bold uppercase tracking-[0.2em] text-text-secondary">
                Now Consulting
              </h1>
              {state.nowConsulting.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-border">
                  <p className="text-center text-3xl font-medium text-text-secondary">
                    Please wait — your token will appear here when called
                  </p>
                </div>
              ) : (
                <div className="grid flex-1 auto-rows-fr gap-6 [grid-template-columns:repeat(auto-fit,minmax(22rem,1fr))]">
                  {state.nowConsulting.map((entry) => (
                    <div
                      key={`${entry.token}-${entry.room ?? entry.doctorLabel}`}
                      className="flex flex-col items-center justify-center rounded-2xl border-2 border-primary/40 bg-primary/5 p-6 text-center"
                    >
                      <span className="text-[6rem] font-black leading-none tracking-tight text-primary sm:text-[8rem] lg:text-[9rem]">
                        {entry.token}
                      </span>
                      {entry.room && (
                        <span className="mt-3 text-2xl font-semibold text-text-primary sm:text-3xl">
                          Room {entry.room}
                        </span>
                      )}
                      <span className="mt-1 text-lg text-text-secondary sm:text-xl">{entry.doctorLabel}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="flex min-h-0 flex-[1.4] flex-col overflow-hidden">
              <h2 className="mb-4 shrink-0 text-xl font-bold uppercase tracking-[0.2em] text-text-secondary">
                Next
              </h2>
              {state.nextTokens.length === 0 ? (
                <p className="text-xl text-text-secondary sm:text-2xl">No further tokens waiting.</p>
              ) : (
                <div className="flex flex-wrap content-start gap-4 overflow-y-auto">
                  {state.nextTokens.map((token, index) => (
                    <span
                      key={`${token}-${index}`}
                      className="rounded-xl border border-border bg-surface px-6 py-3 text-3xl font-bold text-text-primary shadow-card sm:text-4xl"
                    >
                      {token}
                    </span>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="shrink-0 border-t border-border px-8 py-3 text-right text-sm text-text-secondary sm:px-12">
        {state && <span>Last updated {format(new Date(state.updatedAt), 'h:mm:ss a')}</span>}
      </footer>
    </div>
  );
}
