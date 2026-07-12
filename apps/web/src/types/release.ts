export type ReleaseStage = 'beta' | 'rc1' | 'rc2' | 'rc3' | 'ga';
export type ChecklistStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
export type ChecklistCategory =
  | 'produto'
  | 'infra'
  | 'comercial'
  | 'suporte'
  | 'seguranca'
  | 'performance';

export interface ChecklistItem {
  id: string;
  category: ChecklistCategory;
  label: string;
  status: ChecklistStatus;
  blocksRelease: boolean;
  notes: string | null;
  checkedAt: string | null;
  checkedBy: string | null;
}

export interface ChecklistResult {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  skipped: number;
  blockers: number;
  readyForRelease: boolean;
  byCategory: Record<ChecklistCategory, { total: number; passed: number }>;
  items: ChecklistItem[];
}

export interface ReleaseVersion {
  version: string;
  stage: ReleaseStage;
  buildNumber: number;
  gitSha: string;
  releasedAt: string | null;
  certifiedAt: string | null;
  certifiedBy: string | null;
  notes: string | null;
}

export type ChangeType = 'feat' | 'fix' | 'perf' | 'security' | 'breaking' | 'docs' | 'infra';

export interface ChangeEntry {
  id: string;
  type: ChangeType;
  description: string;
  sprint: number;
  component: string;
}

export interface ChangelogVersion {
  version: string;
  releasedAt: string;
  sprint: number;
  codename: string;
  summary: string;
  entries: ChangeEntry[];
}

export interface SBOMComponent {
  name: string;
  version: string;
  license: string;
  type: 'runtime' | 'dev' | 'transitive';
  purl: string;
  vulnerabilities: number;
}

export interface SBOM {
  version: string;
  generatedAt: string;
  format: string;
  components: SBOMComponent[];
  totalComponents: number;
  totalVulnerabilities: number;
  licenses: string[];
}

export type MetricStatus = 'met' | 'not_met' | 'unknown';

export interface GoLiveMetric {
  name: string;
  key: string;
  value: number;
  unit: string;
  target: number;
  targetOperator: 'gte' | 'lte' | 'eq';
  status: MetricStatus;
  description: string;
}

export interface GoLiveSnapshot {
  snapshotAt: string;
  mrr: number;
  arr: number;
  tenants: number;
  agents: number;
  workflowsActive: number;
  connectorsInstalled: number;
  apiCallsPerDay: number;
  aiCreditsUsed: number;
  marketplaceInstalls: number;
  nps: number;
  metrics: GoLiveMetric[];
  metricsMet: number;
  allCriticalMet: boolean;
}
