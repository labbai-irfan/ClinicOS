/**
 * True when running inside a Capacitor native shell (iOS/Android app) rather than a
 * regular browser tab. Capacitor injects `window.Capacitor` at runtime; this stays
 * `false` for the plain web app until the native wrapper is added (ADR-16), so the
 * check is safe to call anywhere today.
 */
export function isNativeApp(): boolean {
  return typeof window !== 'undefined' && Boolean((window as { Capacitor?: unknown }).Capacitor);
}
