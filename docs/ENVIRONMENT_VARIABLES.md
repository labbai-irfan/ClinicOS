# ClinicOS — Environment Variables

Copy `.env.example` to `.env` at the repo root before running `apps/api` or
`apps/worker` in development. `apps/web` reads its own `VITE_*` variables at build
time (Vite only exposes variables prefixed `VITE_` to client code).

## apps/api

| Variable | Required | Default (dev) | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | no | `development` | `test` is set automatically by Vitest |
| `PORT` | no | `4000` | |
| `API_BASE_URL` | no | `http://localhost:4000` | used in generated links (e.g. password reset) |
| `WEB_ORIGIN` | no | `http://localhost:5173` | CORS allow-list and cookie scope; comma-separate multiple origins |
| `MONGODB_URI` | yes (prod) | local Mongo | MongoDB Atlas connection string in production |
| `JWT_ACCESS_SECRET` | yes (prod) | dev placeholder | ≥16 chars; API refuses to boot in production with the placeholder |
| `JWT_REFRESH_SECRET` | yes (prod) | dev placeholder | same as above |
| `ACCESS_TOKEN_TTL` | no | `15m` | jsonwebtoken duration string |
| `REFRESH_TOKEN_TTL` | no | `30d` | |
| `COOKIE_SECURE` | no | `false` | set `true` in production (HTTPS) so the refresh cookie requires TLS |
| `REDIS_URL` | no | unset | optional — see ADR-10; core operations work without it |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | no | unset | documents module returns 503 until all three are set |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | no | `60000` / `300` | global rate limit |
| `AUTH_RATE_LIMIT_MAX` | no | `10` | stricter limit on login/password endpoints |
| `LOCKOUT_MAX_ATTEMPTS` / `LOCKOUT_DURATION_MINUTES` | no | `5` / `15` | account lockout policy |

## apps/worker

| Variable | Required | Notes |
| --- | --- | --- |
| `REDIS_URL` | no | worker idles harmlessly if unset (ADR-10) |
| `NODE_ENV` | no | controls log formatting |

## apps/web

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `VITE_API_URL` | no | `http://localhost:4000` | base URL the browser/app calls; set to the deployed API origin in production |

## Native (Capacitor) builds

No additional environment variables — the native shell points `VITE_API_URL` at the
deployed API origin the same way the web build does (ADR-16). If the app is
distributed to testers before a public API URL exists, point it at the machine
running `apps/api` on the local network during development.
