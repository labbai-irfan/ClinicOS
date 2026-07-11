import { useEffect, useState } from 'react';

/**
 * Ticks periodically so "elapsed since arrival" displays stay live without forcing a
 * re-render (or a socket round-trip) every second. Mirrors the waiting-room display clock.
 */
export function useTickingClock(intervalMs = 15_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
