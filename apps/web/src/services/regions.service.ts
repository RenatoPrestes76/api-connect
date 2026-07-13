import { api } from './api-client';
import type {
  GlobalOverview,
  RegionStatusSummary,
  RegionsListResponse,
  ReplicationResponse,
  FailoverPayload,
  FailoverResult,
  MigratePayload,
  MigrationResult,
  SyncPayload,
  SyncResult,
} from '@/types/regions';

export const regionsService = {
  // GET /api/v1/regions
  getRegions: (params?: { status?: string; continent?: string }): Promise<RegionsListResponse> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.continent) qs.set('continent', params.continent);
    const query = qs.toString() ? `?${qs}` : '';
    return api.get<RegionsListResponse>(`/api/v1/regions${query}`);
  },

  // GET /api/v1/regions/status
  getRegionStatus: (): Promise<RegionStatusSummary> =>
    api.get<RegionStatusSummary>('/api/v1/regions/status'),

  // GET /api/v1/global/overview
  getGlobalOverview: (): Promise<GlobalOverview> =>
    api.get<GlobalOverview>('/api/v1/global/overview'),

  // GET /api/v1/global/replication
  getReplication: (params?: {
    sourceRegion?: string;
    targetRegion?: string;
    status?: string;
  }): Promise<ReplicationResponse> => {
    const qs = new URLSearchParams();
    if (params?.sourceRegion) qs.set('sourceRegion', params.sourceRegion);
    if (params?.targetRegion) qs.set('targetRegion', params.targetRegion);
    if (params?.status) qs.set('status', params.status);
    const query = qs.toString() ? `?${qs}` : '';
    return api.get<ReplicationResponse>(`/api/v1/global/replication${query}`);
  },

  // POST /api/v1/regions/failover
  triggerFailover: (payload: FailoverPayload): Promise<FailoverResult> =>
    api.post<FailoverResult>('/api/v1/regions/failover', payload),

  // POST /api/v1/regions/migrate-tenant
  migrateTenant: (payload: MigratePayload): Promise<MigrationResult> =>
    api.post<MigrationResult>('/api/v1/regions/migrate-tenant', payload),

  // POST /api/v1/regions/sync
  syncRegions: (payload: SyncPayload): Promise<SyncResult> =>
    api.post<SyncResult>('/api/v1/regions/sync', payload),
};
