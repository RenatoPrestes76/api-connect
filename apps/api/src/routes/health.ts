import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../http/router.js';
import { json } from '../http/router.js';
import { prisma } from '../services/prisma.js';

const START_TIME = Date.now();

export async function healthHandler(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  let dbStatus: 'ok' | 'error' = 'ok';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'error';
  }

  const status = dbStatus === 'ok' ? 'healthy' : 'degraded';

  json(res, {
    status,
    version: process.env['npm_package_version'] ?? '0.1.0',
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
    checks: {
      database: dbStatus,
      memory: process.memoryUsage().heapUsed < 512 * 1024 * 1024 ? 'ok' : 'warning',
    },
    timestamp: new Date().toISOString(),
  }, status === 'healthy' ? 200 : 503);
}
