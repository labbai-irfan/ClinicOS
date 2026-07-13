import mongoose from 'mongoose';
import { logger } from './logger';

let connected = false;

/**
 * Lazily connects the worker to the same MongoDB database apps/api uses. Jobs that
 * don't touch the database (none yet) don't need this; jobs that do (appointment
 * reminders) check the return value and skip gracefully if it's false, matching the
 * optional-Redis pattern already used for the whole worker process (ADR-10).
 */
export async function connectDb(): Promise<boolean> {
  if (connected) return true;
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.warn('MONGODB_URI not set — jobs that need database access will be skipped.');
    return false;
  }
  await mongoose.connect(uri);
  connected = true;
  logger.info('Worker connected to MongoDB');
  return true;
}
