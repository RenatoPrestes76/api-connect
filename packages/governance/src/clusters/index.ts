/**
 * @seltriva/governance — clusters
 * Cluster governance: agent cluster registration, node policies, scheduling.
 */

import type { PolicyId, GovernanceResult } from '../policies/index';

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };
export type ClusterId = Branded<string, 'ClusterId'>;

export interface Cluster {
  readonly id: ClusterId;
  readonly organizationId: string;
  readonly environmentId: string;
  readonly name: string;
  readonly description?: string;
  readonly type: ClusterType;
  readonly status: ClusterStatus;
  readonly region?: string;
  readonly nodeCount: number;
  readonly policies: PolicyId[];
  readonly schedulingPolicy: SchedulingPolicy;
  readonly networkPolicy: ClusterNetworkPolicy;
  readonly resourceLimits: ClusterResourceLimits;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type ClusterType = 'single' | 'ha' | 'geo-distributed' | 'edge';
export type ClusterStatus = 'pending' | 'active' | 'degraded' | 'maintenance' | 'retired';

export interface SchedulingPolicy {
  readonly strategy: 'round-robin' | 'least-loaded' | 'affinity' | 'manual';
  readonly affinityRules?: AffinityRule[];
  readonly antiAffinityRules?: AffinityRule[];
  readonly maxAgentsPerNode: number;
  readonly allowHeterogeneousNodes: boolean;
}

export interface AffinityRule {
  readonly label: string;
  readonly value: string;
  readonly weight: number;
}

export interface ClusterNetworkPolicy {
  readonly ingressAllowed: string[]; // CIDR blocks
  readonly egressAllowed: string[];
  readonly encryptInTransit: boolean;
  readonly encryptAtRest: boolean;
  readonly mTLS: boolean;
}

export interface ClusterResourceLimits {
  readonly maxCpuPercent: number;
  readonly maxMemoryPercent: number;
  readonly maxDiskPercent: number;
  readonly maxConcurrentSyncs: number;
}

export interface IClusterGovernanceService {
  register(input: RegisterClusterInput): Promise<GovernanceResult<Cluster>>;
  retire(clusterId: ClusterId, by: string): Promise<GovernanceResult<void>>;
  getById(id: ClusterId): Promise<Cluster | null>;
  listByOrganization(orgId: string): Promise<Cluster[]>;
  setMaintenanceMode(id: ClusterId, enabled: boolean, by: string): Promise<GovernanceResult<void>>;
  enforcePolicy(id: ClusterId): Promise<ClusterPolicyEnforcementReport>;
}

export interface RegisterClusterInput {
  readonly organizationId: string;
  readonly environmentId: string;
  readonly name: string;
  readonly type: ClusterType;
  readonly region?: string;
  readonly registeredBy: string;
}

export interface ClusterPolicyEnforcementReport {
  readonly clusterId: ClusterId;
  readonly policiesChecked: number;
  readonly violations: PolicyViolation[];
  readonly remediations: string[];
  readonly generatedAt: Date;
}

export interface PolicyViolation {
  readonly policyId: string;
  readonly rule: string;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly description: string;
}
