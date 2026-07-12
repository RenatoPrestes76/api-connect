import { api } from '@/services/api-client';
import type {
  ChecklistResult,
  ChecklistItem,
  ChecklistStatus,
  ReleaseVersion,
  ChangelogVersion,
  SBOM,
  GoLiveSnapshot,
} from '@/types/release';

export const releaseService = {
  // Checklist
  getChecklist: () => api.get<ChecklistResult>('/api/v1/release/checklist'),

  getChecklistItem: (id: string) => api.get<ChecklistItem>(`/api/v1/release/checklist/${id}`),

  markChecklistItem: (
    id: string,
    status: ChecklistStatus,
    opts?: { notes?: string; checkedBy?: string }
  ) => api.put<ChecklistItem>(`/api/v1/release/checklist/${id}`, { status, ...opts }),

  // Versions
  listVersions: () =>
    api.get<{ total: number; current: ReleaseVersion; versions: ReleaseVersion[] }>(
      '/api/v1/release/versions'
    ),

  getCurrentVersion: () => api.get<ReleaseVersion>('/api/v1/release/versions/current'),

  getVersion: (version: string) => api.get<ReleaseVersion>(`/api/v1/release/versions/${version}`),

  certifyVersion: (version: string, certifiedBy: string) =>
    api.post<ReleaseVersion>(`/api/v1/release/versions/${version}/certify`, { certifiedBy }),

  // Changelog
  getChangelog: (q?: string) =>
    api.get<{ total: number; versions: ChangelogVersion[] }>(
      `/api/v1/release/changelog${q ? `?q=${encodeURIComponent(q)}` : ''}`
    ),

  getLatestChangelog: () => api.get<ChangelogVersion>('/api/v1/release/changelog/latest'),

  getChangelogVersion: (version: string) =>
    api.get<ChangelogVersion>(`/api/v1/release/changelog/${version}`),

  // SBOM
  getSBOM: () => api.get<SBOM>('/api/v1/release/sbom'),

  getSBOMComponents: (type?: string) =>
    api.get<{ total: number; components: SBOM['components'] }>(
      `/api/v1/release/sbom/components${type ? `?type=${type}` : ''}`
    ),

  // Go-Live Metrics
  getMetrics: () => api.get<GoLiveSnapshot>('/api/v1/release/metrics'),

  updateMetrics: (data: Partial<GoLiveSnapshot>) =>
    api.post<GoLiveSnapshot>('/api/v1/release/metrics', data),
};
