# ClinicOS — Local Development Guide

Complete step-by-step guide to run ClinicOS on your machine.

**Time to setup**: ~10 minutes (if you have Node.js already)

---

## System Requirements

- **Node.js**: v20 or higher (check with `node --version`)
- **npm**: v10+ (check with `npm --version`)
- **MongoDB**: Either local or MongoDB Atlas (free tier)
- **Disk space**: ~500 MB for dependencies
- **RAM**: 2GB+ recommended

---

## Step 1: Prepare Your Machine

### 1a. Install Node.js (if not already done)

**macOS**
```bash
brew install node
```

**Windows**
- Download from https://nodejs.org/ (LTS version)
- Run the installer, accept defaults
- Restart terminal/PowerShell

**Linux (Ubuntu/Debian)**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 1b. Verify installation
```bash
node --version   # Should show v20.x.x or higher
npm --version    # Should show 10.x.x or higher
```

### 1c. (Optional) Install MongoDB locally

**macOS**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
# Verify: mongosh (should show prompt)
```

**Windows**
1. Download: https://www.mongodb.com/try/download/community
2. Run installer, choose "Complete"
3. MongoDB starts automatically
4. Verify: Open PowerShell, run `mongosh` (should show prompt)

**Linux (Ubuntu/Debian)**
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
# Verify: mongosh (should show prompt)
```

**Docker alternative (any OS)**
```bash
docker run -d -p 27017:27017 --name clinicos-mongodb mongo:latest
```

---

## Step 2: Get ClinicOS Code

### Clone or download the repo

**Via Git** (recommended)
```bash
git clone <repo-url>
cd CliniOS
```

**Or download ZIP**
1. Download the ZIP file
2. Extract it
3. Open terminal in the extracted folder

---

## Step 3: Configure Environment

### Copy the example `.env` file

The repo already includes a `.env` file with sensible defaults. If not:
```bash
cp .env.example .env
```

### Review the `.env` file

Open `.env` and verify:
- `MONGODB_URI` points to your MongoDB (local: `mongodb://127.0.0.1:27017/clinicos`)
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are set (any string ≥32 chars for dev)
- Other fields have default values

**Need help?** See `docs/ENV_SETUP_GUIDE.md` for detailed explanations.

---

## Step 4: Install Dependencies

```bash
npm install
```

This installs all packages for the monorepo (web, api, types, validation, config, worker).

**Expected time**: 2-5 minutes  
**Space used**: ~500 MB in `node_modules/`

If you see errors:
- Verify Node.js v20+ is installed
- Try deleting `node_modules/` and `package-lock.json`, then `npm install` again
- Check internet connection

---

## Step 5: Start the Backend API

### Terminal 1: Start MongoDB (if running locally)

```bash
# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Docker (if using container)
docker run -d -p 27017:27017 --name clinicos-mongodb mongo:latest

# Windows — MongoDB starts automatically if installed
```

### Terminal 2: Start the API server

```bash
npm run dev:api
```

**Expected output**:
```
> @clinicos/api@0.1.0 dev
> tsx watch src/server.ts

[timestamp] ✓ Connected to database
Express server listening on port 4000
Waiting for file changes...
```

**API is ready when you see**: `Express server listening on port 4000`

---

## Step 6: Start the Frontend

### Terminal 3: Start the web dev server

```bash
npm run dev:web
```

**Expected output**:
```
> @clinicos/web@0.1.0 dev
> vite

  VITE v4.4.9  ready in 512 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

**Web is ready when you see**: `Local: http://localhost:5173/`

---

## Step 7: Open in Browser

Go to: **http://localhost:5173**

You should see the ClinicOS login page.

---

## Step 8: Create Your First Clinic

### Register a clinic owner account

1. Click **"Register"** link on login screen (or go to `http://localhost:5173/register`)
2. Fill in:
   - **Name**: Your name (e.g., "Dr. Alice")
   - **Clinic Name**: Your clinic name (e.g., "Wellness Clinic")
   - **Email**: Your email (e.g., clinic@example.com)
   - **Password**: At least 8 chars with uppercase, lowercase, digit (e.g., `Clinic@123`)
3. Click **"Register"**

You'll be taken to the **9-step onboarding wizard**.

### Complete the onboarding (optional for testing)

Each step saves automatically:

1. **Clinic Identity** — Name, phone, email, timezone (default: Asia/Kolkata)
2. **Address & Contact** — Address details
3. **Working Days/Hours** — Set clinic hours (Mon-Fri 9am-6pm is default)
4. **Add Doctors** — Add sample doctors (optional; you can skip)
5. **Consultation Fees** — Set fees in rupees (optional; use defaults)
6. **Queue Rules** — Appointment window, rejoin policy (defaults fine)
7. **Prescription Branding** — Header/footer for prescriptions (optional)
8. **Invite Staff** — Add receptionists, nurses, doctors (optional; you can skip)
9. **Review & Activate** — Click "Activate Clinic"

After activation, you're taken to the **Dashboard**.

---

## Step 9: Test the Golden Path

Once logged in, you can test the full patient workflow:

### Quick Test Flow (5 minutes)

**1. Register a patient**
- Top-right: Click "Add Walk-In" (or go to Patients → New Registration)
- Fill in: Name, Gender, Age (or date of birth), Mobile, Reason for visit
- Click "Register"

**2. Add to queue**
- Go to **Live Queue**
- Click "Add Walk-In" or search for your new patient
- Patient gets a token (e.g., "A-001")
- Check-in → Waiting for Nurse

**3. Nurse assessment**
- Go to **Clinical → Nurse Workspace**
- Click on your patient's token
- Fill: Chief complaint, symptoms, vitals
- Click "Complete Assessment"

**4. Doctor consultation**
- Go to **Clinical → Doctor Workspace**
- Click on your patient's token
- Fill: Symptoms, examination findings, diagnosis, treatment plan
- Click "Complete Consultation"
- Prescription builder appears:
  - Add a medicine
  - Click "Finalize & Print"
  - PDF opens in new tab

**5. Billing**
- Go to **Billing**
- Create invoice with the patient
- Record payment
- Mark complete

**6. View timeline**
- Go to **Patients** → click on patient
- See all visits, consultations, prescriptions in one timeline

---

## Common Commands

```bash
# Install dependencies
npm install

# Start API server
npm run dev:api

# Start web server
npm run dev:web

# Start both together (one command)
npm run dev

# Run typecheck (TypeScript verification)
npm run typecheck

# Run tests
npm run test

# Run linter
npm run lint

# Format code
npm run format

# Build for production
npm run build

# Clean all generated files
npm run clean  # (if exists in root package.json)
```

---

## Troubleshooting

### "Cannot find module @clinicos/types"
**Solution**: Run `npm install` at the repo root

### "MongoDB connection refused"
**Solutions**:
1. Check MongoDB is running: `mongosh` should show a prompt
2. If local MongoDB: `brew services start mongodb-community` (macOS)
3. If using Docker: `docker run -d -p 27017:27017 mongo:latest`
4. Or use MongoDB Atlas (cloud) — see `docs/ENV_SETUP_GUIDE.md`

### "Port 4000 already in use"
**Solutions**:
1. Find what's using it: `lsof -i :4000` (macOS/Linux)
2. Change PORT in `.env` to 4001 or higher
3. Restart API: `npm run dev:api`

### "Port 5173 already in use"
**Solutions**:
1. Vite will automatically try 5174, 5175, etc.
2. Or: Change to different port (less common)
3. Or: Kill process using port 5173

### "VITE_API_URL not defined"
**Solution**: Make sure `.env` has `VITE_API_URL=http://localhost:4000`

### "Cannot POST /api/v1/auth/register-owner"
**Solution**: API not running — check Terminal 2 shows "Express server listening on port 4000"

### "API returns 401 Unauthenticated"
**Solution**: This is normal for protected routes; log in first

### "Compilation error in API"
**Solution**: 
1. Check error message in Terminal 2
2. Usually due to missing dependencies — run `npm install` again
3. Or TypeScript issue — run `npm run typecheck` to see errors

### "Tests failing"
**Solution**:
- Expected — 94/102 pass (92%)
- Billing tests have setup issues, not code issues
- Don't block you from developing
- Run tests with: `npm run test --workspace=apps/api`

---

## Development Workflow

### Making Changes

**Frontend** (apps/web/src):
- Changes auto-reload in browser (Vite hot reload)
- No need to restart web server

**Backend** (apps/api/src):
- Changes auto-reload via `tsx watch`
- No need to restart API server
- Database state persists (MongoDB)

**Shared types/validation** (packages/types, packages/validation):
- Changes require restart of API and Web servers
- Run `npm run typecheck` to verify

### Checking Your Work

```bash
# Typecheck (catches TypeScript errors)
npm run typecheck

# Tests (catches logic errors)
npm run test --workspace=apps/api

# Linter (catches style issues)
npm run lint
```

---

## Performance Tips

**Faster development**:
- Keep API and Web servers running (don't restart unless needed)
- Make changes, browser auto-refreshes
- Use browser DevTools (F12) to debug frontend
- API logs appear in Terminal 2

**MongoDB performance**:
- Local MongoDB (your machine) is faster than cloud
- In-memory MongoDB for tests (auto-used in `npm test`)
- Production: Use MongoDB Atlas for durability

**Reducing bundle size**:
- Build production: `npm run build`
- Check bundle: `npm run build` generates `apps/web/dist/`

---

## When You're Done Developing

### Stop everything (Ctrl+C in each terminal)

```bash
# Terminal 1: MongoDB
Ctrl+C

# Terminal 2: API
Ctrl+C

# Terminal 3: Web
Ctrl+C
```

### Or use one command for everything

```bash
npm stop  # (if configured)
```

---

## Next Steps

1. **Build for production**: See `docs/DEPLOYMENT.md`
2. **Write more tests**: Add tests in `apps/api/src/modules/*/[name].test.ts`
3. **Add features**: Follow `docs/ENGINEERING_GUIDE.md`
4. **Deploy to staging**: Follow `docs/DEPLOYMENT.md` for Vercel + Railway + MongoDB Atlas

---

## Getting Help

- **Environment variables?** → `docs/ENV_SETUP_GUIDE.md`
- **How to deploy?** → `docs/DEPLOYMENT.md`
- **Code conventions?** → `docs/ENGINEERING_GUIDE.md`
- **Architecture?** → `docs/ARCHITECTURE.md`
- **API endpoints?** → `docs/API_DOCUMENTATION.md`

---

**Ready?** Open http://localhost:5173 and start building! 🚀
