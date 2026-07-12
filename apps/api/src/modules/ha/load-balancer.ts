import { haStore } from './ha-store.js';
import type {
  ClusterNode,
  LoadBalancerTargetStats,
  LoadBalancingStrategy,
  RouteDecision,
} from './types.js';

export class LoadBalancerError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_HEALTHY_TARGETS' | 'INVALID_WEIGHT'
  ) {
    super(message);
    this.name = 'LoadBalancerError';
  }
}

interface NodeStats {
  activeConnections: number;
  totalRouted: number;
}

const STRATEGIES: LoadBalancingStrategy[] = ['round_robin', 'least_connections', 'weighted'];

/**
 * Real load-distribution over the live HA cluster's healthy nodes (Sprint 47 /
 * ATLAS FORTRESS). This sandbox has no real inbound traffic to intercept, so
 * requests are represented explicitly via route()/release() rather than a network
 * proxy — but the selection algorithms, round-robin cursor, and per-node
 * connection counters are genuinely stateful, not canned output. `rng` is
 * injectable so the weighted strategy is deterministically testable.
 */
export class LoadBalancer {
  private cursor = 0;
  private stats = new Map<string, NodeStats>();
  private weights = new Map<string, number>();

  constructor(private readonly rng: () => number = Math.random) {}

  static isValidStrategy(strategy: string): strategy is LoadBalancingStrategy {
    return STRATEGIES.includes(strategy as LoadBalancingStrategy);
  }

  setWeight(nodeId: string, weight: number): void {
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new LoadBalancerError('weight must be a positive number', 'INVALID_WEIGHT');
    }
    this.weights.set(nodeId, weight);
  }

  private eligibleTargets(includeLeader: boolean): ClusterNode[] {
    return haStore
      .getNodes({ status: 'online' })
      .filter((n) => includeLeader || n.role !== 'leader');
  }

  private statsFor(nodeId: string): NodeStats {
    let stats = this.stats.get(nodeId);
    if (!stats) {
      stats = { activeConnections: 0, totalRouted: 0 };
      this.stats.set(nodeId, stats);
    }
    return stats;
  }

  private pickRoundRobin(targets: ClusterNode[]): ClusterNode {
    const chosen = targets[this.cursor % targets.length];
    this.cursor += 1;
    return chosen;
  }

  private pickLeastConnections(targets: ClusterNode[]): ClusterNode {
    return targets.reduce((best, node) =>
      this.statsFor(node.id).activeConnections < this.statsFor(best.id).activeConnections
        ? node
        : best
    );
  }

  private pickWeighted(targets: ClusterNode[]): ClusterNode {
    const total = targets.reduce((sum, node) => sum + (this.weights.get(node.id) ?? 1), 0);
    let roll = this.rng() * total;
    for (const node of targets) {
      roll -= this.weights.get(node.id) ?? 1;
      if (roll <= 0) return node;
    }
    return targets[targets.length - 1];
  }

  /** Selects a target node for one request under `strategy` and records it as an active connection. */
  route(strategy: LoadBalancingStrategy, options: { includeLeader?: boolean } = {}): RouteDecision {
    const targets = this.eligibleTargets(options.includeLeader ?? false);
    if (targets.length === 0) {
      throw new LoadBalancerError('No online, eligible nodes to route to', 'NO_HEALTHY_TARGETS');
    }

    const chosen =
      strategy === 'round_robin'
        ? this.pickRoundRobin(targets)
        : strategy === 'least_connections'
          ? this.pickLeastConnections(targets)
          : this.pickWeighted(targets);

    const stats = this.statsFor(chosen.id);
    stats.activeConnections += 1;
    stats.totalRouted += 1;

    return {
      nodeId: chosen.id,
      hostname: chosen.hostname,
      strategy,
      activeConnections: stats.activeConnections,
      decidedAt: new Date().toISOString(),
    };
  }

  /** Marks one previously routed request as finished, freeing its connection slot. */
  release(nodeId: string): void {
    const stats = this.stats.get(nodeId);
    if (stats && stats.activeConnections > 0) stats.activeConnections -= 1;
  }

  getDistribution(): LoadBalancerTargetStats[] {
    return haStore.getNodes().map((node) => {
      const stats = this.statsFor(node.id);
      return {
        nodeId: node.id,
        hostname: node.hostname,
        role: node.role,
        status: node.status,
        activeConnections: stats.activeConnections,
        totalRouted: stats.totalRouted,
        weight: this.weights.get(node.id) ?? 1,
      };
    });
  }

  reset(): void {
    this.cursor = 0;
    this.stats.clear();
    this.weights.clear();
  }
}

export const loadBalancer = new LoadBalancer();
