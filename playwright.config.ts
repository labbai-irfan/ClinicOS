import { defineConfig, devices } from '@playwright/test';

/**
 * E2E suite drives three servers: the API (4000), the staff web app, and the patient
 * web app. The web apps run on 5273/5274 — deliberately NOT the project's documented
 * dev ports (5173/5174, see SETUP.md/LOCAL_RUN_GUIDE.md) — because `reuseExistingServer`
 * blindly trusts whatever is already listening on a port without checking it's actually
 * this project; a developer machine with any other Vite app open on the 5173/5174
 * defaults would make Playwright silently test the wrong app. `--strictPort` makes both
 * dev servers fail loudly instead of drifting to a different port on a conflict.
 */
const STAFF_WEB_URL = 'http://localhost:5273';
const PATIENT_WEB_URL = 'http://localhost:5274';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'staff',
      testDir: './e2e/staff',
      use: { ...devices['Desktop Chrome'], baseURL: STAFF_WEB_URL },
    },
    {
      name: 'patient',
      testDir: './e2e/patient',
      use: { ...devices['Desktop Chrome'], baseURL: PATIENT_WEB_URL },
    },
  ],
  webServer: [
    {
      command: 'npm run dev:api',
      url: 'http://localhost:4000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        // Run the API in its `isTest` mode (see apps/api/src/config/env.ts) for the
        // duration of the E2E run: this lifts the auth/global rate limits (they exist to
        // stop brute-forcing in real usage, not to throttle dozens of parallel Playwright
        // workers registering/logging in) and quiets per-request HTTP logging, exactly
        // like the existing vitest suite already gets. A dedicated `clinicos_e2e`
        // database (dropped before every run by `pretest:e2e`) keeps this run isolated
        // from any real local dev data in the default `clinicos` database, and satisfies
        // e2e/patient/patient-portal.spec.ts's documented assumption that it runs
        // against a clean/empty database. WEB_ORIGIN is overridden to match the E2E-only
        // ports above (CORS + Socket.IO both read this — see apps/api/src/app.ts and
        // apps/api/src/realtime/socket.ts) rather than the .env file's documented
        // 5173/5174 defaults.
        NODE_ENV: 'test',
        MONGODB_URI: 'mongodb://127.0.0.1:27017/clinicos_e2e',
        WEB_ORIGIN: `${STAFF_WEB_URL},${PATIENT_WEB_URL}`,
      },
    },
    {
      // Vite invoked directly (not via `npm run dev:web --`) — chaining flags through
      // two layers of npm scripts (`dev:web` -> `dev` -> vite) silently drops them
      // instead of forwarding to vite, so --port/--strictPort never took effect.
      command: 'npx vite --port 5273 --strictPort',
      cwd: 'apps/web',
      url: STAFF_WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npx vite --port 5274 --strictPort',
      cwd: 'apps/patient-web',
      url: PATIENT_WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        // Must match the API's overridden port pairing above, not the .env-documented
        // default (patient-web's own .env hardcodes VITE_API_URL=http://localhost:4000,
        // which is still correct — only the web app's own port changes here).
        VITE_API_URL: 'http://localhost:4000',
      },
    },
  ],
});
