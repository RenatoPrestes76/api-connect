import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { titanStore } from '../../../modules/titan/titan-store.js';
import type { Backup, DrTest } from '../../../modules/titan/titan-store.js';

export function registerDrRoutes(router: {
  get: Function;
  post: Function;
  put: Function;
  delete: Function;
}): void {
  // GET /api/v1/ops/dr — DR status overview
  router.get('/api/v1/ops/dr', (_ctx: RouteContext, res: ServerResponse) => {
    json(res, {
      config: titanStore.getDrConfig(),
      backups: titanStore.listBackups(),
      tests: titanStore.listDrTests(),
    });
  });

  // GET /api/v1/ops/dr/backups
  router.get('/api/v1/ops/dr/backups', (_ctx: RouteContext, res: ServerResponse) => {
    const backups = titanStore.listBackups();
    json(res, { backups, total: backups.length });
  });

  // POST /api/v1/ops/dr/backup/trigger — trigger a new backup
  router.post('/api/v1/ops/dr/backup/trigger', (ctx: RouteContext, res: ServerResponse) => {
    const type = ((ctx.body as any)?.['type'] as Backup['type']) ?? 'incremental';
    if (!['full', 'incremental', 'snapshot'].includes(type)) {
      return apiError(res, 'Invalid backup type', 400, 'INVALID_TYPE');
    }
    const backup = titanStore.triggerBackup(type);
    json(res, { backup }, 202);
  });

  // POST /api/v1/ops/dr/test — record a DR test run
  router.post('/api/v1/ops/dr/test', (ctx: RouteContext, res: ServerResponse) => {
    const body = ctx.body as any;
    const testType = body?.['type'] as DrTest['type'] | undefined;
    if (!testType || !['failover', 'restore', 'partial'].includes(testType)) {
      return apiError(res, '"type" must be failover | restore | partial', 400, 'INVALID_TYPE');
    }
    const test = titanStore.addDrTest({
      type: testType,
      status: body?.['status'] ?? 'passed',
      rtoActual: body?.['rtoActual'] ?? null,
      rpoActual: body?.['rpoActual'] ?? null,
      notes: body?.['notes'] ?? '',
    });
    json(res, { test }, 201);
  });
}
