import { api } from './api-client';
import type {
  ClusterOverview,
  ClusterNode,
  FailoverEvent,
  BackupRecord,
  BackupStatus,
  BackupType,
  RecoveryTest,
  FailoverResult,
  RestoreResult,
  NodeRole,
  NodeStatus,
} from '../types/ha';

export const haService = {
  getCluster(): Promise<ClusterOverview> {
    return api.get('/api/v1/ha/cluster');
  },

  getNodes(filters?: { status?: NodeStatus; role?: NodeRole }): Promise<{
    total: number;
    nodes: ClusterNode[];
    replicationSummary: Record<string, number>;
  }> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.role) params.set('role', filters.role);
    const qs = params.toString() ? `?${params}` : '';
    return api.get(`/api/v1/ha/nodes${qs}`);
  },

  getFailovers(limit?: number): Promise<{ total: number; events: FailoverEvent[] }> {
    const qs = limit ? `?limit=${limit}` : '';
    return api.get(`/api/v1/ha/failovers${qs}`);
  },

  triggerFailover(fromNodeId: string, toNodeId: string, reason?: string): Promise<FailoverResult> {
    return api.post('/api/v1/ha/failover', { fromNodeId, toNodeId, reason });
  },

  getBackups(filters?: { tenantId?: string; status?: BackupStatus }): Promise<{
    total: number;
    totalSizeBytes: number;
    backups: BackupRecord[];
  }> {
    const params = new URLSearchParams();
    if (filters?.tenantId) params.set('tenantId', filters.tenantId);
    if (filters?.status) params.set('status', filters.status);
    const qs = params.toString() ? `?${params}` : '';
    return api.get(`/api/v1/ha/backups${qs}`);
  },

  createBackup(tenantId: string, type: BackupType = 'full'): Promise<BackupRecord> {
    return api.post('/api/v1/ha/backup', { tenantId, type });
  },

  restore(backupId: string, tenantId: string, environment = 'staging'): Promise<RestoreResult> {
    return api.post('/api/v1/ha/restore', { backupId, tenantId, environment });
  },

  getRecoveryTests(tenantId?: string): Promise<{
    total: number;
    passed: number;
    failed: number;
    rtoByTenant: Record<string, number>;
    rpoByTenant: Record<string, number>;
    tests: RecoveryTest[];
  }> {
    const qs = tenantId ? `?tenantId=${tenantId}` : '';
    return api.get(`/api/v1/ha/recovery${qs}`);
  },

  runRecoveryTest(tenantId: string): Promise<RecoveryTest> {
    return api.post('/api/v1/ha/recovery-test', { tenantId });
  },
};
