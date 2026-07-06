import { describe, it, expect, beforeEach } from 'vitest';
import { CheckpointManager } from '../checkpoint/checkpoint-manager.js';
import { asSyncJobId, asTenantId, asCorrelationId } from '../types/index.js';

const JOB_ID  = asSyncJobId('job-test-001');
const TENANT  = asTenantId('tenant-acme');
const CORR    = asCorrelationId('corr-001');
const TABLES  = [
  { schema: 'public', table: 'produto',  detection: 'UPDATED_AT' as const },
  { schema: 'public', table: 'estoque',  detection: 'XMIN' as const },
  { schema: 'vendas', table: 'pedido',   detection: 'ROW_HASH' as const },
];

describe('CheckpointManager', () => {
  let manager: CheckpointManager;

  beforeEach(() => { manager = new CheckpointManager(); });

  describe('create()', () => {
    it('creates a checkpoint with PENDING status', async () => {
      const result = await manager.create({ jobId: JOB_ID, tenantId: TENANT, correlationId: CORR, mode: 'FULL', tables: TABLES });
      expect(result.ok).toBe(true);
      expect(result.ok && result.value.status).toBe('PENDING');
      expect(result.ok && result.value.totalTables).toBe(3);
    });

    it('initializes all tables as PENDING', async () => {
      const result = await manager.create({ jobId: JOB_ID, tenantId: TENANT, correlationId: CORR, mode: 'FULL', tables: TABLES });
      expect(result.ok).toBe(true);
      if (result.ok) {
        for (const t of TABLES) {
          const key = `${t.schema}.${t.table}`;
          expect(result.value.tables.get(key)?.status).toBe('PENDING');
        }
      }
    });
  });

  describe('load()', () => {
    it('returns null for unknown job', async () => {
      const result = await manager.load(asSyncJobId('nonexistent'));
      expect(result.ok).toBe(true);
      expect(result.ok && result.value).toBeNull();
    });

    it('loads created checkpoint', async () => {
      await manager.create({ jobId: JOB_ID, tenantId: TENANT, correlationId: CORR, mode: 'FULL', tables: TABLES });
      const result = await manager.load(JOB_ID);
      expect(result.ok && result.value?.jobId).toBe(JOB_ID);
    });
  });

  describe('updateTable()', () => {
    it('updates table status to IN_PROGRESS', async () => {
      await manager.create({ jobId: JOB_ID, tenantId: TENANT, correlationId: CORR, mode: 'FULL', tables: TABLES });
      const result = await manager.updateTable(JOB_ID, 'public', 'produto', { status: 'IN_PROGRESS', lastOffset: 1000 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const tc = result.value.tables.get('public.produto');
        expect(tc?.status).toBe('IN_PROGRESS');
        expect(tc?.lastOffset).toBe(1000);
      }
    });

    it('tracks completedTables count', async () => {
      await manager.create({ jobId: JOB_ID, tenantId: TENANT, correlationId: CORR, mode: 'FULL', tables: TABLES });
      await manager.updateTable(JOB_ID, 'public', 'produto', { status: 'COMPLETED' });
      await manager.updateTable(JOB_ID, 'public', 'estoque', { status: 'COMPLETED' });
      const result = await manager.load(JOB_ID);
      expect(result.ok && result.value?.completedTables).toBe(2);
    });

    it('returns error for unknown table', async () => {
      await manager.create({ jobId: JOB_ID, tenantId: TENANT, correlationId: CORR, mode: 'FULL', tables: TABLES });
      const result = await manager.updateTable(JOB_ID, 'public', 'nao_existe', { status: 'COMPLETED' });
      expect(result.ok).toBe(false);
    });
  });

  describe('updateStatus()', () => {
    it('updates job status', async () => {
      await manager.create({ jobId: JOB_ID, tenantId: TENANT, correlationId: CORR, mode: 'FULL', tables: TABLES });
      await manager.updateStatus(JOB_ID, 'RUNNING');
      const r = await manager.load(JOB_ID);
      expect(r.ok && r.value?.status).toBe('RUNNING');
    });

    it('stores error message', async () => {
      await manager.create({ jobId: JOB_ID, tenantId: TENANT, correlationId: CORR, mode: 'FULL', tables: TABLES });
      await manager.updateStatus(JOB_ID, 'FAILED', { error: 'Connection refused' });
      const r = await manager.load(JOB_ID);
      expect(r.ok && r.value?.lastError).toBe('Connection refused');
    });
  });

  describe('incrementRetry()', () => {
    it('increments retry count and sets RECOVERING status', async () => {
      await manager.create({ jobId: JOB_ID, tenantId: TENANT, correlationId: CORR, mode: 'FULL', tables: TABLES });
      await manager.incrementRetry(JOB_ID);
      const r = await manager.load(JOB_ID);
      expect(r.ok && r.value?.retryCount).toBe(1);
      expect(r.ok && r.value?.status).toBe('RECOVERING');
    });
  });

  describe('isTableComplete()', () => {
    it('returns true for completed table', async () => {
      const { value: cp } = await manager.create({ jobId: JOB_ID, tenantId: TENANT, correlationId: CORR, mode: 'FULL', tables: TABLES }) as { value: { tables: Map<string, { status: string }> } & object; ok: true };
      await manager.updateTable(JOB_ID, 'public', 'produto', { status: 'COMPLETED' });
      const updated = await manager.load(JOB_ID);
      expect(updated.ok && updated.value && manager.isTableComplete(updated.value, 'public', 'produto')).toBe(true);
    });

    it('returns false for pending table', async () => {
      await manager.create({ jobId: JOB_ID, tenantId: TENANT, correlationId: CORR, mode: 'FULL', tables: TABLES });
      const r = await manager.load(JOB_ID);
      expect(r.ok && r.value && manager.isTableComplete(r.value, 'public', 'estoque')).toBe(false);
    });
  });

  describe('delete()', () => {
    it('removes checkpoint', async () => {
      await manager.create({ jobId: JOB_ID, tenantId: TENANT, correlationId: CORR, mode: 'FULL', tables: TABLES });
      await manager.delete(JOB_ID);
      const r = await manager.load(JOB_ID);
      expect(r.ok && r.value).toBeNull();
    });
  });

  describe('incrementRetry() — error path', () => {
    it('returns error when no checkpoint exists', async () => {
      const result = await manager.incrementRetry(asSyncJobId('no-such-job'));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('CHECKPOINT_NOT_FOUND');
    });
  });

  describe('listByTenant()', () => {
    it('returns all checkpoints for a tenant', async () => {
      const JOB_2 = asSyncJobId('job-test-002');
      await manager.create({ jobId: JOB_ID, tenantId: TENANT, correlationId: CORR, mode: 'FULL', tables: TABLES });
      await manager.create({ jobId: JOB_2,  tenantId: TENANT, correlationId: CORR, mode: 'FULL', tables: TABLES });
      const list = await manager.listByTenant(TENANT);
      expect(list.length).toBe(2);
    });
  });
});
