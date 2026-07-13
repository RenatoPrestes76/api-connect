import { describe, it, expect } from 'vitest';
import { SnapshotManager } from '../snapshot/snapshot-manager.js';
import { asSyncJobId, asTenantId, asCorrelationId } from '../types/index.js';

const JOB = asSyncJobId('job-snap-001');
const TENANT = asTenantId('tenant-acme');
const CORR = asCorrelationId('corr-001');

const TABLES = [
  {
    schema: 'public',
    table: 'produto',
    rowCount: 1000,
    checksum: 'abc123',
    snapshotAt: new Date().toISOString(),
  },
  {
    schema: 'public',
    table: 'cliente',
    rowCount: 500,
    checksum: 'def456',
    snapshotAt: new Date().toISOString(),
  },
];

describe('SnapshotManager', () => {
  it('creates a snapshot with generated id and totalRows', () => {
    const mgr = new SnapshotManager();
    const snap = mgr.create({
      jobId: JOB,
      tenantId: TENANT,
      correlationId: CORR,
      database: 'erp',
      host: 'db.local',
      tables: TABLES,
    });
    expect(snap.id).toBeDefined();
    expect(snap.totalRows).toBe(1500);
    expect(snap.tables).toHaveLength(2);
    expect(snap.createdAt).toBeDefined();
  });

  it('get() retrieves by id', () => {
    const mgr = new SnapshotManager();
    const snap = mgr.create({
      jobId: JOB,
      tenantId: TENANT,
      correlationId: CORR,
      database: 'erp',
      host: 'db.local',
      tables: TABLES,
    });
    expect(mgr.get(snap.id)).toEqual(snap);
  });

  it('get() returns null for unknown id', () => {
    const mgr = new SnapshotManager();
    expect(mgr.get('nonexistent')).toBeNull();
  });

  it('latest() returns most recent snapshot for tenant+database', () => {
    const mgr = new SnapshotManager();
    mgr.create({
      jobId: JOB,
      tenantId: TENANT,
      correlationId: CORR,
      database: 'erp',
      host: 'h',
      tables: TABLES,
      note: 'first',
    });
    const second = mgr.create({
      jobId: JOB,
      tenantId: TENANT,
      correlationId: CORR,
      database: 'erp',
      host: 'h',
      tables: TABLES,
      note: 'second',
    });
    const latest = mgr.latest(TENANT, 'erp');
    expect(latest?.id).toBe(second.id);
  });

  it('latest() returns null when no snapshots match', () => {
    const mgr = new SnapshotManager();
    expect(mgr.latest(TENANT, 'erp')).toBeNull();
  });

  it('listByTenant() returns only snapshots for that tenant', () => {
    const mgr = new SnapshotManager();
    const otherTenant = asTenantId('tenant-other');
    mgr.create({
      jobId: JOB,
      tenantId: TENANT,
      correlationId: CORR,
      database: 'erp',
      host: 'h',
      tables: TABLES,
    });
    mgr.create({
      jobId: JOB,
      tenantId: TENANT,
      correlationId: CORR,
      database: 'crm',
      host: 'h',
      tables: TABLES,
    });
    mgr.create({
      jobId: JOB,
      tenantId: otherTenant,
      correlationId: CORR,
      database: 'erp',
      host: 'h',
      tables: TABLES,
    });

    expect(mgr.listByTenant(TENANT)).toHaveLength(2);
    expect(mgr.listByTenant(otherTenant)).toHaveLength(1);
  });

  it('delete() removes a snapshot', () => {
    const mgr = new SnapshotManager();
    const snap = mgr.create({
      jobId: JOB,
      tenantId: TENANT,
      correlationId: CORR,
      database: 'erp',
      host: 'h',
      tables: TABLES,
    });
    expect(mgr.delete(snap.id)).toBe(true);
    expect(mgr.get(snap.id)).toBeNull();
    expect(mgr.size).toBe(0);
  });

  it('diff() detects changed tables', () => {
    const mgr = new SnapshotManager();
    const before = mgr.create({
      jobId: JOB,
      tenantId: TENANT,
      correlationId: CORR,
      database: 'erp',
      host: 'h',
      tables: TABLES,
    });
    const after = mgr.create({
      jobId: JOB,
      tenantId: TENANT,
      correlationId: CORR,
      database: 'erp',
      host: 'h',
      tables: [
        { ...TABLES[0]!, checksum: 'CHANGED', snapshotAt: new Date().toISOString() },
        TABLES[1]!,
      ],
    });
    const changed = mgr.diff(before, after);
    expect(changed).toContain('public.produto');
    expect(changed).not.toContain('public.cliente');
  });

  it('diff() detects row count changes', () => {
    const mgr = new SnapshotManager();
    const before = mgr.create({
      jobId: JOB,
      tenantId: TENANT,
      correlationId: CORR,
      database: 'erp',
      host: 'h',
      tables: TABLES,
    });
    const after = mgr.create({
      jobId: JOB,
      tenantId: TENANT,
      correlationId: CORR,
      database: 'erp',
      host: 'h',
      tables: [TABLES[0]!, { ...TABLES[1]!, rowCount: 9999 }],
    });
    expect(mgr.diff(before, after)).toContain('public.cliente');
  });
});
