import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { haStore } from '../../../modules/ha/ha-store.js';
import { backupService } from '../../../modules/ha/backup-service.js';
import type { BackupStatus } from '../../../modules/ha/types.js';

const VALID_STATUSES: BackupStatus[] = ['completed', 'failed', 'in_progress'];

export function registerHaBackupRoutes(router: { get: Function; post: Function }): void {
  router.get('/api/v1/ha/backups', (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = ctx.query.get('tenantId') ?? undefined;
    const status = ctx.query.get('status') ?? undefined;

    if (status && !VALID_STATUSES.includes(status as BackupStatus)) {
      return apiError(
        res,
        `status must be one of: ${VALID_STATUSES.join(', ')}`,
        400,
        'INVALID_STATUS'
      );
    }

    const backups = haStore.getBackups(tenantId, status as BackupStatus | undefined);
    const totalSize = backups.reduce((s, b) => s + b.sizeBytes, 0);
    json(res, { total: backups.length, totalSizeBytes: totalSize, backups });
  });

  router.post('/api/v1/ha/backup', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { tenantId, type = 'full' } = body;

    if (!tenantId) return apiError(res, '"tenantId" is required', 400, 'MISSING_FIELDS');
    if (!backupService.validateType(type)) {
      return apiError(res, 'type must be one of: full, incremental, snapshot', 400, 'INVALID_TYPE');
    }

    const record = backupService.createBackup(tenantId, type);
    json(res, record, 201);
  });

  router.post('/api/v1/ha/restore', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { backupId, tenantId, environment = 'staging' } = body;

    if (!backupId) return apiError(res, '"backupId" is required', 400, 'MISSING_FIELDS');
    if (!tenantId) return apiError(res, '"tenantId" is required', 400, 'MISSING_FIELDS');

    try {
      const result = backupService.restore(backupId, tenantId, environment);
      json(res, result);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'BACKUP_NOT_FOUND') return apiError(res, 'Backup not found', 404, 'NOT_FOUND');
      if (code === 'BACKUP_FILE_MISSING')
        return apiError(res, 'Backup file is missing from disk', 410, 'BACKUP_FILE_MISSING');
      if (code === 'BACKUP_CHECKSUM_MISMATCH')
        return apiError(
          res,
          'Backup file checksum does not match the recorded checksum',
          409,
          'CHECKSUM_MISMATCH'
        );
      return apiError(res, (err as Error).message, 500, 'RESTORE_ERROR');
    }
  });
}
