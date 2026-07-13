// Drops the scratch `clinicos_e2e` database before every E2E run so the suite always
// starts from a clean slate. This matters beyond tidiness: e2e/patient/patient-portal.spec.ts
// documents that self-service patient registration attaches to whichever active clinic was
// created *first* in the database, so leftover clinics from a previous run would silently
// point new patients at the wrong clinic's branches/doctors. Runs against a dedicated
// database (never the default `clinicos` dev database), so it never touches real dev data.
import { MongoClient } from 'mongodb';

const uri = process.env.E2E_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/clinicos_e2e';

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
try {
  await client.connect();
  await client.db().dropDatabase();
  console.log(`[e2e-reset-db] dropped ${uri}`);
} catch (err) {
  console.warn(`[e2e-reset-db] could not reset ${uri}: ${err.message}`);
  console.warn('[e2e-reset-db] continuing anyway — the E2E database may contain leftover data.');
} finally {
  await client.close();
}
