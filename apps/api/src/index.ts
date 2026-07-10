/**
 * Seltriva Connect API — Entry Point
 */
import 'dotenv/config';
import { createLogger } from '@seltriva/logger';
import { getConfig } from '@seltriva/config';
import { createApiServer } from './server.js';

const logger = createLogger('api');

async function main(): Promise<void> {
  const config = getConfig();

  logger.info('Starting Seltriva Connect API', {
    environment: config.env,
    port: config.api.port,
  });

  // Connect to database (optional in dev — all sprint modules use in-memory stores)
  let disconnectDB: (() => Promise<void>) | undefined;
  try {
    const prismaService = await import('./services/prisma.js');
    await prismaService.connectDB();
    disconnectDB = prismaService.disconnectDB;
    logger.info('Database connected');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (config.env === 'production') {
      logger.error('Database connection failed', { error: msg });
      process.exit(1);
    } else {
      logger.warn('Database unavailable — running with in-memory stores only', { error: msg });
    }
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
      await disconnectDB?.();
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
  process.on('SIGINT', () => void shutdown('SIGINT'));
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
