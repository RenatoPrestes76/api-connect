import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BackupRecord, BackupType, RestoreResult } from './types.js';
import { haStore } from './ha-store.js';
import {
  controlPlaneStore,
  type ControlPlaneSnapshot,
} from '../control-plane/control-plane-store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
/** apps/api/.data/backups — see .gitignore for the `.data/` exclusion. */
const BACKUP_DIR = join(__dirname, '..', '..', '..', '.data', 'backups');

interface BackupFile {
  tenantId: string;
  type: BackupType;
  capturedAt: string;
  snapshot: ControlPlaneSnapshot;
}

function backupFilePath(id: string): string {
  return join(BACKUP_DIR, `${id}.json`);
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

const VALID_TYPES: BackupType[] = ['full', 'incremental', 'snapshot'];

/**
 * Genuine disk-backed Disaster Recovery backups of Control Plane state (Sprint 47 /
 * ATLAS FORTRESS). Replaces the earlier fabricated implementation (random checksum,
 * hardcoded size lookup table, no real restore). Every backup captures a real,
 * serializable snapshot of ControlPlaneStore via controlPlaneStore.exportSnapshot(),
 * writes it to disk, and records a SHA-256 checksum of the actual file contents.
 *
 * Honesty note: this sandbox has no write-ahead log to diff against, so every
 * BackupType currently captures full state — "incremental"/"snapshot" only vary
 * the retention window (expiresAt), not payload size. A true incremental backup
 * would require WAL-based change tracking, which is out of scope here.
 */
export class BackupService {
  validateType(type: string): type is BackupType {
    return VALID_TYPES.includes(type as BackupType);
  }

  createBackup(tenantId: string, type: BackupType): BackupRecord {
    mkdirSync(BACKUP_DIR, { recursive: true });

    const capturedAt = new Date().toISOString();
    const file: BackupFile = {
      tenantId,
      type,
      capturedAt,
      snapshot: controlPlaneStore.exportSnapshot(),
    };
    const payload = JSON.stringify(file);
    const sizeBytes = Buffer.byteLength(payload, 'utf8');
    const checksum = `sha256:${createHash('sha256').update(payload).digest('hex')}`;

    const expiresAt = new Date(
      Date.now() + (type === 'full' ? 30 : type === 'snapshot' ? 14 : 7) * 24 * 60 * 60_000
    ).toISOString();

    const record = haStore.createBackup({
      tenantId,
      type,
      sizeBytes,
      sizeLabel: formatBytes(sizeBytes),
      status: 'completed',
      checksum,
      createdAt: capturedAt,
      expiresAt,
    });

    writeFileSync(backupFilePath(record.id), payload, 'utf8');

    haStore.addHaEvent({
      type: 'backup.completed',
      severity: 'info',
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} backup completed for ${tenantId} (${formatBytes(sizeBytes)})`,
      payload: { backupId: record.id, tenantId, type, sizeLabel: formatBytes(sizeBytes) },
    });

    return record;
  }

  /** Reads the backup file, verifies its checksum against the ledger, and returns the parsed snapshot. */
  private loadVerified(backupId: string): { backup: BackupRecord; file: BackupFile } {
    const backup = haStore.getBackup(backupId);
    if (!backup) throw Object.assign(new Error('BACKUP_NOT_FOUND'), { code: 'BACKUP_NOT_FOUND' });

    const filePath = backupFilePath(backupId);
    if (!existsSync(filePath)) {
      throw Object.assign(new Error('BACKUP_FILE_MISSING'), { code: 'BACKUP_FILE_MISSING' });
    }

    const raw = readFileSync(filePath, 'utf8');
    const checksum = `sha256:${createHash('sha256').update(raw).digest('hex')}`;
    if (checksum !== backup.checksum) {
      throw Object.assign(new Error('BACKUP_CHECKSUM_MISMATCH'), {
        code: 'BACKUP_CHECKSUM_MISMATCH',
      });
    }

    return { backup, file: JSON.parse(raw) as BackupFile };
  }

  /** Genuinely restores Control Plane state from a verified backup file. Returns real, measured elapsed time. */
  restore(backupId: string, tenantId: string, environment: string): RestoreResult {
    const { file } = this.loadVerified(backupId);

    const restoreId = genId('rst');
    const startedAt = new Date().toISOString();

    haStore.addHaEvent({
      type: 'restore.started',
      severity: 'info',
      message: `Restore initiated from backup ${backupId} to ${environment}`,
      payload: { restoreId, backupId, tenantId, environment },
    });

    const t0 = Date.now();
    controlPlaneStore.importSnapshot(file.snapshot);
    const elapsedMs = Date.now() - t0;

    haStore.addHaEvent({
      type: 'restore.completed',
      severity: 'info',
      message: `Restore completed from backup ${backupId} to ${environment} in ${elapsedMs}ms`,
      payload: { restoreId, backupId, tenantId, environment, elapsedMs },
    });

    return {
      success: true,
      restoreId,
      backupId,
      tenantId,
      environment,
      startedAt,
      estimatedDuration: `${elapsedMs}ms (measured)`,
      message: `Restore from backup ${backupId} completed for ${tenantId} (environment: ${environment}, elapsed: ${elapsedMs}ms)`,
    };
  }

  /** Exposed for recovery-service.ts's real capture→mutate→restore→verify test cycle. */
  loadSnapshot(backupId: string): ControlPlaneSnapshot {
    return this.loadVerified(backupId).file.snapshot;
  }
}

export const backupService = new BackupService();
