import mongoose from 'mongoose';
import { env } from '../config/env';
import { logger } from '../shared/logger';

mongoose.set('strictQuery', true);

export async function connectDatabase(uri = env.MONGODB_URI): Promise<void> {
  await mongoose.connect(uri, { autoIndex: env.NODE_ENV !== 'production' });
  logger.info({ db: mongoose.connection.name }, 'MongoDB connected');
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

/** True when the deployment supports multi-document transactions (replica set). */
export function supportsTransactions(): boolean {
  // mongodb-memory-server (standalone) and many dev setups do not run a replica set.
  const client = mongoose.connection.getClient();
  const topology = (client as unknown as { topology?: { s?: { description?: { type?: string } } } })
    .topology;
  const type = topology?.s?.description?.type;
  return type === 'ReplicaSetWithPrimary' || type === 'Sharded' || type === 'LoadBalanced';
}
