# ClinicOS — Deployment

Target stack (ADR-17): **Vercel** (web) + **Railway or Render** (api — a persistent
Node process, required for Socket.IO) + **MongoDB Atlas** + **Cloudinary** + optional
**Redis Cloud**. Nothing in the codebase is tied to these specific providers — the
API is a standard Node/Express server (Dockerfile-friendly), so moving to AWS later
(spec's alternative) is a configuration change, not a rewrite.

## 1. Database — MongoDB Atlas

1. Create a free/shared-tier cluster.
2. Create a database user and copy the connection string.
3. Set it as `MONGODB_URI` on the API host (see `docs/ENVIRONMENT_VARIABLES.md`).
4. Network access: allow the API host's IP (or `0.0.0.0/0` only if the host has no
   static IP — prefer an IP allow-list or Atlas's PrivateLink/VPC peering once traffic
   is real).

## 2. Media — Cloudinary

1. Create a free-tier account, copy Cloud Name / API Key / API Secret.
2. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` on the
   API host. Until these are set, the documents module returns `503
   SERVICE_UNAVAILABLE` instead of failing — the rest of the app is unaffected.

## 3. API — Railway or Render

Both platforms run a persistent container, which Socket.IO requires (do **not**
deploy `apps/api` to a serverless/edge platform — ADR/spec explicitly rule this out).

1. Point the service at the repo, root directory `apps/api`.
2. Build command: `npm install && npm run build --workspace=apps/api` (run from the
   repo root so npm workspaces resolves `@clinicos/*`).
3. Start command: `npm run start --workspace=apps/api` (runs the esbuild bundle in
   `apps/api/dist/server.mjs`).
4. Set all `apps/api` environment variables from `docs/ENVIRONMENT_VARIABLES.md`,
   with `NODE_ENV=production`, `COOKIE_SECURE=true`, and real JWT secrets (the API
   refuses to boot in production with the placeholder secrets — see `config/env.ts`).
5. Set `WEB_ORIGIN` to the deployed web app's origin (comma-separate if there's also
   a native/Capacitor origin to allow).
6. Health check path: `/health`.

## 4. Web — Vercel

1. Import the repo, set the project root to `apps/web`.
2. Build command: `npm install && npm run build` (Vercel runs this from
   `apps/web`; if workspace hoisting causes issues, build from the repo root with
   `npm run build --workspace=apps/web` instead).
3. Output directory: `apps/web/dist`.
4. Set `VITE_API_URL` to the deployed API's public URL.
5. SPA rewrite: add a catch-all rewrite (`/* → /index.html`) so client-side routes
   (e.g. `/patients/42`) don't 404 on refresh — Vercel does this automatically for
   Vite SPAs when no `vercel.json` overrides it; add one if needed.

## 5. Background worker (optional)

`apps/worker` is only needed once reminders/report-generation matter (ADR-10). Deploy
it the same way as the API (Railway/Render, persistent process) with `REDIS_URL` set,
build command `npm install && npm run build --workspace=apps/worker`, start command
`npm run start --workspace=apps/worker`. Skip this service entirely in an early
deployment — the API works fully without it.

## 6. Native app (Capacitor) — when ready

Per ADR-16, `apps/web` is built mobile-ready so it can be wrapped later:

1. `npm install -D @capacitor/core @capacitor/cli` inside `apps/web`, then
   `npx cap init` (app id, app name).
2. `npx cap add ios` / `npx cap add android`.
3. Set `VITE_API_URL` to the deployed API origin before building — the native shell
   loads the built static bundle, it does not run a local dev server in production.
4. `npm run build && npx cap sync`, then open in Xcode/Android Studio to build and
   sign the app for store submission.
5. The native client should send `X-Client-Type: native` on every API request and
   store the `refreshToken` returned by login/register in secure device storage
   (Capacitor's Preferences/Secure Storage plugin) — the web `apiClient` already
   implements this branch (`apps/web/src/lib/platform.ts`,
   `apps/web/src/lib/api-client.ts`); no backend changes are needed.

## Rollback

Both Vercel and Railway/Render keep prior deployments — use their dashboard's
"redeploy previous" action. There is no destructive migration step in a standard
deploy; only run database migrations deliberately and with a backup.
