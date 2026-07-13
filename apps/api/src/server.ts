import { createServer } from 'node:http';
import { env } from './config/env';
import { logger } from './shared/logger';
import { connectDatabase, disconnectDatabase } from './database/connection';
import { createApp } from './app';
import { initSocket } from './realtime/socket';
import { initJobQueue } from './shared/job-queue';

async function main(): Promise<void> {
  await connectDatabase();
  initJobQueue();

  const app = createApp();
  const server = createServer(app);
  initSocket(server);

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'ClinicOS API listening');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.fatal({ err }, 'failed to start API');
  process.exit(1);
});
