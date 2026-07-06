/**
 * Seltriva Connect API — Entry Point
 */
import { createLogger } from '@seltriva/logger';
import { getConfig } from '@seltriva/config';
import { createApiServer } from './server.js';
import { connectDB, disconnectDB } from './services/prisma.js';

const logger = createLogger('api');

async function main(): Promise<void> {
  const config = getConfig();

  logger.info('Starting Seltriva Connect API', {
    environment: config.env,
    port: config.api.port,
  });

  // Connect to database
  try {
    await connectDB();
    logger.info('Database connected');
  } catch (err) {
    logger.error('Database connection failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }

  // Start HTTP server
  const server = createApiServer();
  const port = config.api.port;

  server.listen(port, () => {
    logger.info('API server ready', {
      port,
      url: `http://localhost:${port}`,
      endpoints: [
        `GET  http://localhost:${port}/health`,
        `GET  http://localhost:${port}/api/v1/organizations`,
        `GET  http://localhost:${port}/api/v1/agents`,
        `GET  http://localhost:${port}/api/v1/plugins`,
        `POST http://localhost:${port}/api/v1/discovery/analyze-schema`,
        `GET  http://localhost:${port}/api/v1/discovery/entities`,
        `GET  http://localhost:${port}/api/v1/discovery/suggestions`,
        `GET  http://localhost:${port}/api/v1/discovery/graph`,
      ],
    });
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal} — shutting down`);
    server.close(async () => {
      await disconnectDB();
      logger.info('API server stopped');
      process.exit(0);
    });

    // Force exit after 10s
    setTimeout(() => {
      logger.error('Forceful shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT',  () => void shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason: String(reason) });
  });
}

main().catch((err: unknown) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
