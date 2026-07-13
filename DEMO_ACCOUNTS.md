# ClinicOS — Demo Accounts

## Seed command

Run from the repo root (`ClinicOS` folder). Safe to re-run anytime — it only creates what's missing.

```
npm run seed:demo
```

## Login credentials

| App | URL | Email | Password |
|---|---|---|---|
| Staff web — Owner/Admin | http://localhost:5173 | `admin@demo.com` | `Demo1234` |
| Staff web — Doctor | http://localhost:5173 | `doctor@demo.com` | `Doctor1234` |
| Patient portal | http://localhost:5174 (run `npm run dev:patient-web`) | `patient@demo.com` | `Patient1234` |

## What gets seeded

- **Demo Clinic** — activated, onboarding already complete (skips the setup wizard)
- **1 branch** — Main Branch
- **1 doctor** — Dr. Asha Rao, General Medicine, ₹300 consultation fee
- **4 patients** — Ravi Kumar, Priya Sharma, Imran Sheikh, Sunita Devi
- **3 appointments** — scheduled for today with the doctor
- **1 patient portal account** — linked to the Demo Clinic

## Notes

- Owner (`admin@demo.com`) has full `clinic_owner` permissions — use this account to test everything.
- All accounts are created through the app's real registration/invite services, so the data behaves exactly like genuine usage.
- If the database is ever wiped, just run `npm run seed:demo` again to rebuild everything.
