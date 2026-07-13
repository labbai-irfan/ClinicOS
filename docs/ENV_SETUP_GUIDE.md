# ClinicOS — Environment Variables Setup Guide

Complete guide to obtaining and configuring all required environment variables for local development.

## Quick Start

1. Copy `.env.example` to `.env` at the repo root
2. Fill in the values using this guide
3. Run `npm run dev:api` and `npm run dev:web`

---

## Backend (apps/api) Variables

### Node Environment

```
NODE_ENV=development
```
- **What**: Sets the runtime environment
- **For development**: `development` (enables console logging, verbose errors)
- **For production**: `production` (suppresses sensitive details in logs)
- **Where to get**: Just set it yourself — no external service needed

### Server Configuration

```
PORT=4000
```
- **What**: The port Express API server runs on
- **For local dev**: `4000` (or any free port)
- **Where to get**: Pick any available port; verify it's not in use with:
  ```bash
  # Linux/Mac
  lsof -i :4000
  # Windows PowerShell
  Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue
  ```

```
API_BASE_URL=http://localhost:4000
```
- **What**: Public URL of the API (used in generated email links, etc.)
- **For local dev**: `http://localhost:4000`
- **For production**: Your deployed API domain (e.g., `https://api.clinicos.com`)
- **Where to get**: Just set it yourself based on your deployment target

```
WEB_ORIGIN=http://localhost:5173,http://localhost:5174
```
- **What**: URL(s) of the web app(s) (CORS allow-list)
- **For local dev**: `http://localhost:5173,http://localhost:5174` — the staff app (5173) *and* the patient portal (5174); both are separate origins and both need to be listed or the patient app's API calls are silently blocked by CORS
- **For production**: Your deployed web domains (e.g., `https://app.clinicos.com,https://patient.clinicos.com`)
- **Supports multiple**: Comma-separated, no spaces around the comma needed (trimmed automatically)
- **Where to get**: Just set it yourself — but if you add a new frontend app on a new port/domain, remember to add it here too

---

## Database (MongoDB)

```
MONGODB_URI=mongodb://127.0.0.1:27017/clinicos
```

### Local Development (easiest)

**Option A: Use Local MongoDB (recommended for dev)**

1. **Install MongoDB Community Edition**
   - **macOS**: `brew install mongodb-community`
   - **Windows**: Download from https://www.mongodb.com/try/download/community
   - **Linux**: Follow https://docs.mongodb.com/manual/administration/install-on-linux/

2. **Start MongoDB locally**
   ```bash
   # macOS/Linux
   brew services start mongodb-community
   # or manually
   mongod --dbpath /your/data/path
   
   # Windows (PowerShell)
   net start MongoDB
   ```

3. **Set the URI**
   ```
   MONGODB_URI=mongodb://127.0.0.1:27017/clinicos
   ```
   Database `clinicos` is created automatically on first use.

4. **Verify connection**
   ```bash
   mongosh "mongodb://127.0.0.1:27017/clinicos"
   # or just: mongosh
   ```

**Option B: MongoDB Atlas (cloud, free tier available)**

1. **Create a free account**: https://www.mongodb.com/cloud/atlas
2. **Create a free cluster**:
   - Click "Build a Database"
   - Choose "Free" (M0 Sandbox)
   - Select a region near you
   - Create a cluster (takes ~5-10 min)
3. **Create a database user**:
   - Go to Database Access
   - Create a user (e.g., clinicos_user)
   - Note the password
4. **Get the connection string**:
   - Go to Clusters → Connect
   - Choose "Drivers"
   - Copy the connection string
   - Replace `<password>` with your user password
   - Replace `myFirstDatabase` with `clinicos`
5. **Set the URI**:
   ```
   MONGODB_URI=mongodb+srv://clinicos_user:your_password@cluster0.xxxxx.mongodb.net/clinicos?retryWrites=true&w=majority
   ```
6. **Allow your IP**:
   - Go to Network Access
   - Add your current IP (or 0.0.0.0 for anywhere during dev)

---

## Authentication (JWT Secrets)

```
JWT_ACCESS_SECRET=change-me-access-secret-min-32-characters
JWT_REFRESH_SECRET=change-me-refresh-secret-min-32-characters
```

- **What**: Secret keys used to sign/verify JSON Web Tokens
- **Requirements**: 
  - ≥32 characters long
  - Must be different for access and refresh tokens
  - Must be kept secret (never commit to git)
- **For local dev**: Can be any 32+ character string
  ```
  JWT_ACCESS_SECRET=my-super-secret-access-key-thats-at-least-32-characters
  JWT_REFRESH_SECRET=my-super-secret-refresh-key-thats-at-least-32-characters
  ```
- **For production**: Use a cryptographically random string
  ```bash
  # Generate random 32-char secrets
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  # Run twice for access and refresh secrets
  ```
- **Where to get**: Generate them yourself with the command above or use:
  https://www.random.org/strings/ (length: 32, charset: alphanumeric)

```
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=30d
```
- **What**: How long tokens remain valid
- **ACCESS_TOKEN_TTL**: How long before user must refresh (15 min is typical)
- **REFRESH_TOKEN_TTL**: How long user stays logged in overall (30 days typical)
- **Formats**: `15m`, `1h`, `7d`, `30d` (per jsonwebtoken duration strings)
- **Where to get**: Set based on your security policy — defaults are fine for dev

```
COOKIE_SECURE=false
```
- **What**: Whether refresh token cookies require HTTPS
- **For local dev**: `false` (HTTP only)
- **For production**: `true` (HTTPS required — critical for security)
- **Where to get**: Just set it based on environment

---

## Redis (Optional Background Jobs)

```
REDIS_URL=redis://127.0.0.1:6379
```

- **What**: Cache/queue backend for background jobs (reminders, PDFs, reports)
- **For local dev**: Optional; core operations work without it
  - If omitted: reminder jobs queue but don't execute
  - If set: jobs run immediately
- **To enable locally**:

  **Option A: Redis locally**
  ```bash
  # macOS
  brew install redis
  brew services start redis
  
  # Docker (easiest)
  docker run -d -p 6379:6379 redis:latest
  ```
  Then set:
  ```
  REDIS_URL=redis://127.0.0.1:6379
  ```

  **Option B: Skip for now** (just omit or comment out)
  ```
  # REDIS_URL=redis://127.0.0.1:6379
  ```

---

## Cloudinary (Document Storage)

```
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

- **What**: Cloud storage for patient documents (PDFs, images)
- **For local dev**: 
  - Optional during development
  - If omitted: document upload returns 503 "not configured"
  - Core app works fine without it
- **To enable**:

  1. **Create a free Cloudinary account**: https://cloudinary.com/users/register/free
  2. **Get your credentials**:
     - Dashboard shows **Cloud Name** (e.g., `dxyz12345`)
     - Go to Settings → API Keys
     - Copy **API Key** and **API Secret**
  3. **Set the variables**:
     ```
     CLOUDINARY_CLOUD_NAME=dxyz12345
     CLOUDINARY_API_KEY=123456789012345
     CLOUDINARY_API_SECRET=abcdefghijklmnop_1234567890
     ```

  4. **Verify**: Upload a document through the app; it should work

- **For local dev without uploads**: Leave blank
  ```
  CLOUDINARY_CLOUD_NAME=
  CLOUDINARY_API_KEY=
  CLOUDINARY_API_SECRET=
  ```

---

## Twilio (SMS/WhatsApp Appointment Reminders)

```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_SMS_FROM=
TWILIO_WHATSAPP_FROM=
APPOINTMENT_REMINDER_CHANNEL=sms
APPOINTMENT_REMINDER_HOURS_BEFORE=3
```

- **What**: Sends patients an SMS or WhatsApp reminder before their appointment
- **Needs**: `REDIS_URL` configured (see [Redis](#redis-optional-background-jobs) above) AND `apps/worker` running — reminders are scheduled by the API but sent by the worker process
- **For local dev**: Optional entirely
  - If `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` are blank: reminder jobs still get scheduled and picked up by the worker, but the send is logged and dropped (visible in the worker's logs and in the `messageLogs` collection with `status: 'failed'`)
  - Core app (booking, queue, billing, etc.) is completely unaffected either way

- **To enable**:

  1. **Create a free Twilio account**: https://www.twilio.com/try-twilio
  2. **Get your Account SID and Auth Token**: shown on the Twilio Console dashboard (https://console.twilio.com) right after signup
  3. **Get an SMS-capable phone number**: Console → Phone Numbers → Buy a number (trial accounts get a free number; SMS to Indian numbers may need A2P/DLT registration outside the trial — see Twilio's India compliance docs)
  4. **Set SMS variables**:
     ```
     TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
     TWILIO_AUTH_TOKEN=your_auth_token_here
     TWILIO_SMS_FROM=+15017122661
     ```
  5. **(Optional) Enable WhatsApp**: Console → Messaging → Try it out → Send a WhatsApp message gives you a **sandbox number** (e.g. `whatsapp:+14155238886`) for testing — the recipient must first send the sandbox's join code from their own WhatsApp before they can receive messages from it. A production WhatsApp sender requires Twilio's WhatsApp Business Profile approval process (separate from the SMS number).
     ```
     TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
     APPOINTMENT_REMINDER_CHANNEL=whatsapp
     ```
  6. **Verify**: Book an appointment less than `APPOINTMENT_REMINDER_HOURS_BEFORE` hours out won't send anything (too late, skipped by design); book one further out, then check the worker's logs around the scheduled reminder time (or query the `messageLogs` collection directly) for `status: 'sent'`

- **For local dev without SMS/WhatsApp**: Leave all four blank — this is the default, nothing to do

---

## Rate Limiting

```
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=300
AUTH_RATE_LIMIT_MAX=10
```

- **RATE_LIMIT_WINDOW_MS**: Time window in milliseconds (60000 = 60 sec = 1 min)
- **RATE_LIMIT_MAX**: Max requests per window globally (300 per min = 5/sec)
- **AUTH_RATE_LIMIT_MAX**: Max login attempts per window (10 per min)
- **For local dev**: Use defaults (or increase RATE_LIMIT_MAX if testing heavily)
- **For production**: Keep defaults or adjust based on expected traffic
- **Where to get**: Set based on your security/performance needs

---

## Account Lockout

```
LOCKOUT_MAX_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=15
```

- **LOCKOUT_MAX_ATTEMPTS**: Failed login attempts before account locks (5 is standard)
- **LOCKOUT_DURATION_MINUTES**: How long account stays locked (15 min is standard)
- **For local dev**: Use defaults or increase for easier testing
  ```
  LOCKOUT_MAX_ATTEMPTS=100  # Easier testing
  LOCKOUT_DURATION_MINUTES=1  # Quick unlock
  ```
- **For production**: Keep defaults or make more strict
- **Where to get**: Set based on your security policy

---

## Frontend (apps/web) Variables

```
VITE_API_URL=http://localhost:4000
```

- **What**: URL the browser calls for API requests
- **For local dev**: `http://localhost:4000` (matches your API backend)
- **For production**: Your deployed API URL (e.g., `https://api.clinicos.com`)
- **Important**: Must be accessible from the browser (no localhost in production!)
- **Where to get**: Just set it yourself based on your API deployment

---

## Complete .env Template

```bash
# ========== BACKEND (apps/api) ==========

# Environment
NODE_ENV=development
PORT=4000
API_BASE_URL=http://localhost:4000
WEB_ORIGIN=http://localhost:5173,http://localhost:5174

# Database
MONGODB_URI=mongodb://127.0.0.1:27017/clinicos

# Auth (generate your own secrets!)
JWT_ACCESS_SECRET=your-secret-access-key-at-least-32-characters
JWT_REFRESH_SECRET=your-secret-refresh-key-at-least-32-characters
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=30d
COOKIE_SECURE=false

# Redis (optional — comment out to disable)
REDIS_URL=redis://127.0.0.1:6379

# Cloudinary (optional — leave blank to skip)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Appointment reminders (needs REDIS_URL above and apps/worker running)
APPOINTMENT_REMINDER_HOURS_BEFORE=3

# Rate limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=300
AUTH_RATE_LIMIT_MAX=10

# Account lockout
LOCKOUT_MAX_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=15

# ========== FRONTEND (apps/web) ==========

VITE_API_URL=http://localhost:4000

# ========== PATIENT PORTAL (apps/patient-web) ==========

VITE_API_URL=http://localhost:4000

# ========== WORKER (apps/worker) ==========

# Twilio (optional — leave blank to skip; reminders logged and dropped)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_SMS_FROM=
TWILIO_WHATSAPP_FROM=
APPOINTMENT_REMINDER_CHANNEL=sms
```

---

## Verification Checklist

After filling in `.env`, verify everything works:

```bash
# 1. Check MongoDB connection
mongosh "mongodb://127.0.0.1:27017/clinicos"
# Should show: "clinicos>" prompt

# 2. Start API (should boot without errors)
npm run dev:api
# Should show: "Express server listening on port 4000"

# 3. In another terminal, start Web
npm run dev:web
# Should show: "Local: http://localhost:5173"

# 4. Open browser to http://localhost:5173
# Should see: ClinicOS login screen

# 5. Try registering a clinic
# Should work without errors
```

If any step fails, check the error message and re-read the relevant section above.

---

## Troubleshooting

| Issue | Solution |
| --- | --- |
| "ECONNREFUSED" on MongoDB connection | MongoDB not running — start it with `mongod` or `brew services start mongodb-community` |
| "RATE_LIMITED" error immediately | RATE_LIMIT_MAX too low; increase to 1000 for local testing |
| "Service unavailable" for documents | Cloudinary not configured; either set credentials or leave blank (returns 503 safely) |
| "Cannot find module @clinicos/types" | Run `npm install` at repo root to install all dependencies |
| "Port 4000 already in use" | Change PORT to an available port (e.g., 4001) |
| "Redis connection refused" | Redis not running; either start it or comment out REDIS_URL in .env |
| Appointment reminders never arrive | Check three things in order: (1) REDIS_URL is set and Redis is running, (2) `apps/worker` is actually running (`npm run dev:worker`), (3) TWILIO_ACCOUNT_SID/AUTH_TOKEN/SMS_FROM (or WHATSAPP_FROM) are set — check the worker's logs or the `messageLogs` collection for the specific failure reason |

---

## Next Steps

1. **Fill in `.env`** using this guide
2. **Run `npm install`** (if not already done)
3. **Follow `docs/LOCAL_RUN_GUIDE.md`** to start the app
4. **Test the golden path**: register → onboard → patient → queue → consultation
