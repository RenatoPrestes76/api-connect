/**
 * @seltriva/governance — nodes
 * Node governance: node registration, health policies, drain/evict lifecycle.
 */

import type { ClusterId } from '../clusters/index';
import type { GovernanceResult } from '../policies/index';

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };
export type NodeId = Branded<string, 'NodeId'>;

export interface ClusterNode {
  readonly id: NodeId;
  readonly clusterId: ClusterId;
  readonly organizationId: string;
  readonly hostname: string;
  readonly ipAddress: string;
  readonly platform: 'linux' | 'darwin' | 'win32';
  readonly arch: 'x64' | 'arm64' | 'arm';
  readonly nodeVersion: string;
  readonly agentVersion: string;
  readonly status: NodeStatus;
  readonly labels: Record<string, string>;
  readonly taints: NodeTaint[];
  readonly capacities: NodeCapacity;
  readonly allocatable: NodeCapacity;
  readonly conditions: NodeCondition[];
  readonly registeredAt: Date;
  readonly lastHeartbeatAt?: Date;
}

export type NodeStatus =
  | 'registering'
  | 'ready'
  | 'not-ready'
  | 'draining'
  | 'drained'
  | 'evicted'
  | 'retired';

export interface NodeTaint {
  readonly key: string;
  readonly value?: string;
  readonly effect: 'no-schedule' | 'prefer-no-schedule' | 'no-execute';
}

export interface NodeCapacity {
  readonly cpuCores: number;
  readonly memoryMb: number;
  readonly diskGb: number;
  readonly maxAgents: number;
}

export interface NodeCondition {
  readonly type: NodeConditionType;
  readonly status: 'true' | 'false' | 'unknown';
  readonly message?: string;
  readonly lastTransitionAt: Date;
}

export type NodeConditionType =
  | 'Ready'
  | 'MemoryPressure'
  | 'DiskPressure'
  | 'NetworkUnavailable'
  | 'PIDPressure';

export interface INodeGovernanceService {
  register(input: RegisterNodeInput): Promise<GovernanceResult<ClusterNode>>;
  deregister(nodeId: NodeId, by: string): Promise<GovernanceResult<void>>;
  drain(nodeId: NodeId, gracePeriodSeconds: number, by: string): Promise<GovernanceResult<void>>;
  evict(nodeId: NodeId, reason: string, by: string): Promise<GovernanceResult<void>>;
  getById(id: NodeId): Promise<ClusterNode | null>;
  listByCluster(clusterId: ClusterId): Promise<ClusterNode[]>;
  applyLabel(nodeId: NodeId, key: string, value: string): Promise<GovernanceResult<void>>;
  applyTaint(nodeId: NodeId, taint: NodeTaint): Promise<GovernanceResult<void>>;
  removeTaint(nodeId: NodeId, key: string): Promise<GovernanceResult<void>>;
}

export interface RegisterNodeInput {
  readonly clusterId: ClusterId;
  readonly organizationId: string;
  readonly hostname: string;
  readonly ipAddress: string;
  readonly platform: ClusterNode['platform'];
  readonly arch: ClusterNode['arch'];
  readonly nodeVersion: string;
  readonly agentVersion: string;
  readonly capacities: NodeCapacity;
  readonly labels?: Record<string, string>;
}
