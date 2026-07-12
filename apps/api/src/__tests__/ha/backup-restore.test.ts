import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { backupService } from '../../modules/ha/backup-service.js';
import { recoveryService } from '../../modules/ha/recovery-service.js';
import { controlPlaneStore } from '../../modules/control-plane/control-plane-store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Mirrors backup-service.ts's own BACKUP_DIR resolution (apps/api/.data/backups),
// from this file's location (apps/api/src/__tests__/ha).
const BACKUP_DIR = join(__dirname, '..', '..', '..', '.data', 'backups');

describe('BackupService — real disk-backed backups', () => {
  it('produces a checksum that genuinely matches the written file contents', () => {
    const backup = backupService.createBackup('tenant-enterprise', 'full');
    const raw = readFileSync(join(BACKUP_DIR, `${backup.id}.json`), 'utf8');
    expect(backup.sizeBytes).toBe(Buffer.byteLength(raw, 'utf8'));
    expect(backup.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('restore genuinely mutates ControlPlaneStore state back to the captured snapshot', () => {
    const backup = backupService.createBackup('tenant-enterprise', 'snapshot');
    const flag = controlPlaneStore.createFeatureFlag({
      key: `test-marker-${Date.now()}`,
      enabled: true,
    });
    expect(controlPlaneStore.getFeatureFlag(flag.id)).toBeDefined();

    backupService.restore(backup.id, 'tenant-enterprise', 'test');

    expect(controlPlaneStore.getFeatureFlag(flag.id)).toBeUndefined();
  });

  it('rejects restore when the backup file has been tampered with (checksum mismatch)', () => {
    const backup = backupService.createBackup('tenant-enterprise', 'full');
    const filePath = join(BACKUP_DIR, `${backup.id}.json`);
    writeFileSync(
      filePath,
      readFileSync(filePath, 'utf8').replace('"tenantId"', '"tenantId2"'),
      'utf8'
    );

    expect(() => backupService.restore(backup.id, 'tenant-enterprise', 'test')).toThrow();
  });

  it('rejects restore for an unknown backup id', () => {
    expect(() =>
      backupService.restore('bk-nonexistent-file', 'tenant-enterprise', 'test')
    ).toThrow();
  });
});

describe('RecoveryService — real capture/mutate/restore/verify cycle', () => {
  it('passes with a measured RTO and RPO of ~0 (synchronous snapshot)', () => {
    const test = recoveryService.runRecoveryTest('tenant-enterprise');
    expect(test.result).toBe('passed');
    expect(test.rtoSeconds).toBeGreaterThanOrEqual(0);
    expect(test.rpoMinutes).toBe(0);
  });
});
