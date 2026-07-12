import { haStore } from './ha-store.js';
import { failoverEngine } from './failover-engine.js';
import type { ClusterNode, FailoverResult } from './types.js';

const HEARTBEAT_TIMEOUT_MS = 15_000;
const MONITOR_TICK_MS = 5_000;

export interface ElectionRecord {
  id: string;
  term: number;
  triggeredBy: 'automatic' | 'manual';
  reason: string;
  candidateId: string | null;
  candidateHostname: string | null;
  onlineVoters: number;
  totalNodes: number;
  quorumMet: boolean;
  outcome: 'elected' | 'no_candidate' | 'quorum_not_met';
  decidedAt: string;
}

/**
 * Term-based automatic leader election over apps/api/src/modules/ha's cluster
 * nodes. Reuses the existing failoverEngine/haStore rather than duplicating
 * failover mechanics — this module only adds AUTOMATIC failure detection and
 * candidate selection on top of the previously manual-only failover.
 *
 * Detection: nodes with status 'online' have their heartbeat auto-refreshed
 * each monitor tick (simulating a live process). A node taken offline via
 * simulateNodeFailure() stops refreshing and is detected as failed once its
 * heartbeat exceeds HEARTBEAT_TIMEOUT_MS — this is the hook chaos tests use
 * to exercise real automatic failover end-to-end.
 *
 * Quorum: an automatic election requires a strict majority of nodes to still
 * be online (split-brain prevention). Without quorum, automatic election is
 * refused — call runElection({ force: true }) to override for manual DR drills.
 */
class LeaderElection {
  private term = 0;
  private history: ElectionRecord[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), MONITOR_TICK_MS);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getCurrentTerm(): number {
    return this.term;
  }

  getHistory(): ElectionRecord[] {
    return [...this.history].sort((a, b) => b.decidedAt.localeCompare(a.decidedAt));
  }

  /** Marks a node offline and stops its simulated heartbeat — the chaos-testing hook. */
  simulateNodeFailure(nodeId: string): ClusterNode | null {
    return haStore.updateNode(nodeId, { status: 'offline' });
  }

  recoverNode(nodeId: string): ClusterNode | null {
    return haStore.updateNode(nodeId, {
      status: 'online',
      lastHeartbeat: new Date().toISOString(),
    });
  }

  private tick(): void {
    this.refreshLiveHeartbeats();
    this.checkLeaderHealth('automatic', 'leader heartbeat stale or leader offline');
  }

  private refreshLiveHeartbeats(): void {
    const now = new Date().toISOString();
    for (const node of haStore.getNodes({ status: 'online' })) {
      haStore.updateNode(node.id, { lastHeartbeat: now });
    }
  }

  private isLeaderHealthy(leader: ClusterNode | undefined): boolean {
    if (!leader) return false;
    if (leader.status !== 'online') return false;
    const ageMs = Date.now() - new Date(leader.lastHeartbeat).getTime();
    return ageMs < HEARTBEAT_TIMEOUT_MS;
  }

  private checkLeaderHealth(
    triggeredBy: 'automatic' | 'manual',
    reason: string
  ): FailoverResult | null {
    const leader = haStore.getNodes({ role: 'leader' })[0];
    if (this.isLeaderHealthy(leader)) return null;
    return this.runElection({ reason, triggeredBy });
  }

  /** Runs an election now, regardless of current leader health. */
  runElection(options: {
    reason: string;
    triggeredBy?: 'automatic' | 'manual';
    force?: boolean;
  }): FailoverResult | null {
    const allNodes = haStore.getNodes();
    const onlineNodes = allNodes.filter((n) => n.status === 'online');
    const quorumMet = onlineNodes.length > allNodes.length / 2;
    const leader = allNodes.find((n) => n.role === 'leader');

    const candidates = haStore
      .getNodesWithReplication({ status: 'online' })
      .filter((n) => n.id !== leader?.id && (n.role === 'secondary' || n.role === 'standby'))
      .sort((a, b) => {
        const aInSync = a.replication?.status === 'in_sync' ? 0 : 1;
        const bInSync = b.replication?.status === 'in_sync' ? 0 : 1;
        if (aInSync !== bInSync) return aInSync - bInSync;
        const aLag = a.replication?.lagMs ?? Number.MAX_SAFE_INTEGER;
        const bLag = b.replication?.lagMs ?? Number.MAX_SAFE_INTEGER;
        if (aLag !== bLag) return aLag - bLag;
        return a.role === 'secondary' ? -1 : 1;
      });

    const winner = candidates[0];

    if (!quorumMet && !options.force) {
      this.record({
        term: this.term,
        triggeredBy: options.triggeredBy ?? 'automatic',
        reason: options.reason,
        candidateId: null,
        candidateHostname: null,
        onlineVoters: onlineNodes.length,
        totalNodes: allNodes.length,
        quorumMet: false,
        outcome: 'quorum_not_met',
      });
      haStore.addHaEvent({
        type: 'node.degraded',
        severity: 'critical',
        message: `Automatic election refused — quorum not met (${onlineNodes.length}/${allNodes.length} nodes online)`,
        payload: { onlineNodes: onlineNodes.length, totalNodes: allNodes.length },
      });
      return null;
    }

    if (!winner || !leader) {
      this.record({
        term: this.term,
        triggeredBy: options.triggeredBy ?? 'automatic',
        reason: options.reason,
        candidateId: null,
        candidateHostname: null,
        onlineVoters: onlineNodes.length,
        totalNodes: allNodes.length,
        quorumMet,
        outcome: 'no_candidate',
      });
      haStore.addHaEvent({
        type: 'node.degraded',
        severity: 'critical',
        message: 'No eligible candidate available for leader election — cluster is leaderless',
        payload: { onlineNodes: onlineNodes.length },
      });
      return null;
    }

    this.term += 1;
    const result = failoverEngine.triggerFailover(
      leader.id,
      winner.id,
      options.reason,
      options.triggeredBy !== 'manual'
    );

    this.record({
      term: this.term,
      triggeredBy: options.triggeredBy ?? 'automatic',
      reason: options.reason,
      candidateId: winner.id,
      candidateHostname: winner.hostname,
      onlineVoters: onlineNodes.length,
      totalNodes: allNodes.length,
      quorumMet,
      outcome: 'elected',
    });

    return result;
  }

  private record(entry: Omit<ElectionRecord, 'id' | 'decidedAt'>): void {
    this.history.push({
      id: `elec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      decidedAt: new Date().toISOString(),
      ...entry,
    });
  }
}

export const leaderElection = new LeaderElection();
leaderElection.start();
