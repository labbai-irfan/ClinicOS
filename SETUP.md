# ClinicOS — Quick Setup Guide

Get ClinicOS running locally in **~10 minutes**.

## TL;DR (Ultra-Quick Start)

```bash
# 1. Install dependencies
npm install

# 2. Make sure MongoDB is running
mongod  # or: brew services start mongodb-community

# 3. Terminal 1: Start API
npm run dev:api

# 4. Terminal 2: Start Web
npm run dev:web

# 5. Open browser
open http://localhost:5173
```

Done! Create a clinic account and start testing.

---

## Detailed Setup

See **`docs/LOCAL_RUN_GUIDE.md`** for step-by-step instructions including:
- System requirements (Node.js v20+)
- MongoDB setup (local or cloud)
- Starting both servers
- Testing the golden path
- Troubleshooting

## Environment Configuration

See **`docs/ENV_SETUP_GUIDE.md`** for detailed instructions on:
- **What each `.env` variable does**
- **How to get values for each variable** (MongoDB, JWT secrets, Cloudinary, etc.)
- **Local MongoDB setup** (or MongoDB Atlas)
- **Optional integrations** (Redis, Cloudinary)

The `.env` file is already pre-configured with sensible defaults for local development.

## Architecture & Code

- **Architecture**: `docs/ARCHITECTURE.md`
- **Tech decisions**: `docs/DECISIONS.md`
- **Code conventions**: `docs/ENGINEERING_GUIDE.md`
- **Module structure**: `docs/ENGINEERING_GUIDE.md`

## Deployment

- **Deploy to Vercel + Railway + MongoDB Atlas**: `docs/DEPLOYMENT.md`

## API & Features

- **API endpoints**: `docs/API_DOCUMENTATION.md`
- **Roles & permissions**: `docs/RBAC_MATRIX.md`
- **Queue system**: `docs/QUEUE_ENGINE.md`
- **Emergency workflow**: `docs/EMERGENCY_WORKFLOW.md`

## Project Status

- **What's done**: `docs/PROGRESS.md`
- **What's next**: `docs/PROGRESS.md` → "Next (Phase 2)"

---

## Verify Your Setup

After starting the servers:

```bash
# API should show:
# Express server listening on port 4000

# Web should show:
# Local: http://localhost:5173/
```

Then open **http://localhost:5173** and you should see the ClinicOS login screen.

---

**Need help?** Open `docs/LOCAL_RUN_GUIDE.md` for detailed troubleshooting.

**Ready to code?** Open `docs/ENGINEERING_GUIDE.md` for file layout and conventions.

**Want to deploy?** Open `docs/DEPLOYMENT.md` for Vercel + Railway setup.
