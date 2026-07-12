import type { BackupRecord, BackupType, RestoreResult } from './types.js';
import { haStore } from './ha-store.js';

const SIZE_BY_TYPE: Record<BackupType, { bytes: number; label: string }> = {
  full: { bytes: 1_800_000_000, label: '1.8 GB' },
  incremental: { bytes: 160_000_000, label: '160 MB' },
  snapshot: { bytes: 700_000_000, label: '700 MB' },
};

function genChecksum(): string {
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const VALID_TYPES: BackupType[] = ['full', 'incremental', 'snapshot'];

export class BackupService {
  validateType(type: string): type is BackupType {
    return VALID_TYPES.includes(type as BackupType);
  }

  createBackup(tenantId: string, type: BackupType): BackupRecord {
    const { bytes, label } = SIZE_BY_TYPE[type];
    const expiresAt = new Date(
      Date.now() + (type === 'full' ? 30 : type === 'snapshot' ? 14 : 7) * 24 * 60 * 60_000
    ).toISOString();

    const record = haStore.createBackup({
      tenantId,
      type,
      sizeBytes: bytes,
      sizeLabel: label,
      status: 'completed',
      checksum: `sha256:${genChecksum()}`,
      createdAt: new Date().toISOString(),
      expiresAt,
    });

    haStore.addHaEvent({
      type: 'backup.completed',
      severity: 'info',
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} backup completed for ${tenantId} (${label})`,
      payload: { backupId: record.id, tenantId, type, sizeLabel: label },
    });

    return record;
  }

  restore(backupId: string, tenantId: string, environment: string): RestoreResult {
    const backup = haStore.getBackup(backupId);
    if (!backup) throw Object.assign(new Error('BACKUP_NOT_FOUND'), { code: 'BACKUP_NOT_FOUND' });

    const restoreId = genId('rst');
    const startedAt = new Date().toISOString();
    const estMinutes =
      backup.type === 'full'
        ? '~15 minutes'
        : backup.type === 'snapshot'
          ? '~8 minutes'
          : '~3 minutes';

    haStore.addHaEvent({
      type: 'restore.started',
      severity: 'info',
      message: `Restore initiated from backup ${backupId} to ${environment}`,
      payload: { restoreId, backupId, tenantId, environment },
    });

    return {
      success: true,
      restoreId,
      backupId,
      tenantId,
      environment,
      startedAt,
      estimatedDuration: estMinutes,
      message: `Restore from backup ${backupId} initiated for ${tenantId} (environment: ${environment}, estimated: ${estMinutes})`,
    };
  }
}

export const backupService = new BackupService();
