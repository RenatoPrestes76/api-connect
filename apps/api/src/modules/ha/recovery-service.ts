import type { RecoveryTest } from './types.js';
import { haStore } from './ha-store.js';
import { backupService } from './backup-service.js';
import { controlPlaneStore } from '../control-plane/control-plane-store.js';

const KNOWN_TENANTS = ['tenant-enterprise', 'tenant-professional', 'tenant-community'];

/**
 * Genuine recovery drill (Sprint 47 / ATLAS FORTRESS). Replaces the earlier fabricated
 * implementation (hardcoded per-tenant RTO/RPO lookup tables, no actual test performed).
 *
 * Each run performs a real capture -> mutate -> restore -> verify cycle against
 * ControlPlaneStore: it snapshots current state, introduces a detectable synthetic
 * mutation (a throwaway feature flag), restores from the snapshot via backupService,
 * and verifies the mutation is gone. RTO is the real measured wall-clock duration of
 * the restore step. Because the backup is a synchronous, in-process snapshot (no
 * async replication lag in this architecture), RPO is genuinely ~0 — that is an
 * honest property of this design, not a placeholder.
 */
export class RecoveryService {
  isKnownTenant(tenantId: string): boolean {
    return KNOWN_TENANTS.includes(tenantId);
  }

  runRecoveryTest(tenantId: string): RecoveryTest {
    const testedAt = new Date().toISOString();
    const t0 = Date.now();

    let result: 'passed' | 'failed' = 'passed';
    let notes: string;
    let rtoSeconds = 0;

    try {
      const backup = backupService.createBackup(tenantId, 'snapshot');

      const marker = controlPlaneStore.createFeatureFlag({
        key: `__recovery-drill-marker-${Date.now()}`,
        enabled: true,
        description:
          'Synthetic mutation created by a DR recovery test — should not survive restore.',
      });

      const restoreStart = Date.now();
      backupService.restore(backup.id, tenantId, 'recovery-drill');
      rtoSeconds = (Date.now() - restoreStart) / 1000;

      const survived = controlPlaneStore.getFeatureFlag(marker.id) !== undefined;
      if (survived) {
        result = 'failed';
        notes = `Restore completed but did not revert post-backup state (marker flag ${marker.id} survived) — RTO: ${rtoSeconds.toFixed(3)}s`;
        controlPlaneStore.deleteFeatureFlag(marker.id);
      } else {
        notes = `Capture -> mutate -> restore -> verify cycle passed. RTO: ${rtoSeconds.toFixed(3)}s (measured), RPO: ~0min (synchronous in-process snapshot)`;
      }
    } catch (err) {
      result = 'failed';
      rtoSeconds = (Date.now() - t0) / 1000;
      notes = `Recovery drill failed: ${err instanceof Error ? err.message : String(err)}`;
    }

    const durationMs = Date.now() - t0;
    const rpoMinutes = 0;

    const test = haStore.addRecoveryTest({
      tenantId,
      result,
      rtoSeconds: Number(rtoSeconds.toFixed(3)),
      rpoMinutes,
      durationMs,
      notes,
      testedAt,
    });

    haStore.addHaEvent({
      type: result === 'passed' ? 'recovery.test.passed' : 'recovery.test.failed',
      severity: result === 'passed' ? 'info' : 'error',
      message: `Recovery test ${result} for ${tenantId} — RTO: ${rtoSeconds.toFixed(3)}s, RPO: ${rpoMinutes}min`,
      payload: { testId: test.id, tenantId, rtoSeconds, rpoMinutes },
    });

    return test;
  }

  getRtoByTenant(): Record<string, number> {
    const passed = haStore.getRecoveryTests().filter((t) => t.result === 'passed');
    const byTenant: Record<string, number[]> = {};
    for (const t of passed) {
      (byTenant[t.tenantId] ??= []).push(t.rtoSeconds);
    }
    return Object.fromEntries(
      Object.entries(byTenant).map(([id, rtos]) => [
        id,
        Math.round(rtos.reduce((a, b) => a + b, 0) / rtos.length),
      ])
    );
  }

  getRpoByTenant(): Record<string, number> {
    const passed = haStore.getRecoveryTests().filter((t) => t.result === 'passed');
    const byTenant: Record<string, number[]> = {};
    for (const t of passed) {
      (byTenant[t.tenantId] ??= []).push(t.rpoMinutes);
    }
    return Object.fromEntries(
      Object.entries(byTenant).map(([id, rpos]) => [
        id,
        Math.round(rpos.reduce((a, b) => a + b, 0) / rpos.length),
      ])
    );
  }
}

export const recoveryService = new RecoveryService();
