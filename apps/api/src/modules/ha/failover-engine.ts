import type { FailoverResult } from './types.js';
import { haStore } from './ha-store.js';

export class FailoverEngine {
  triggerFailover(
    fromNodeId: string,
    toNodeId: string,
    reason: string,
    automatic = false
  ): FailoverResult {
    const fromNode = haStore.getNode(fromNodeId);
    const toNode = haStore.getNode(toNodeId);

    if (!fromNode)
      throw Object.assign(new Error('SOURCE_NODE_NOT_FOUND'), { code: 'SOURCE_NODE_NOT_FOUND' });
    if (!toNode)
      throw Object.assign(new Error('TARGET_NODE_NOT_FOUND'), { code: 'TARGET_NODE_NOT_FOUND' });

    haStore.addHaEvent({
      type: 'failover.initiated',
      severity: 'warning',
      message: `Failover initiated: ${fromNode.hostname} → ${toNode.hostname}`,
      payload: { fromNodeId, toNodeId, reason, automatic },
    });

    const startTs = Date.now();
    haStore.updateNode(fromNodeId, { status: 'offline' });
    const newLeader = haStore.promoteNodeToLeader(toNodeId)!;
    const durationMs = Date.now() - startTs + 500 + Math.floor(Math.random() * 200);
    const rtoSeconds = Math.max(1, Math.ceil(durationMs / 1000));

    const event = haStore.addFailoverEvent({
      fromNodeId,
      fromHostname: fromNode.hostname,
      toNodeId,
      toHostname: toNode.hostname,
      reason,
      automatic,
      startedAt: new Date(startTs).toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs,
      rtoSeconds,
      success: true,
    });

    haStore.addHaEvent({
      type: 'failover.completed',
      severity: 'info',
      message: `Failover completed in ${rtoSeconds}s — ${toNode.hostname} is new leader`,
      payload: { failoverId: event.id, rtoSeconds },
    });

    return {
      event,
      newLeader,
      affectedNodes: 1,
      message: `Failover successful. ${toNode.hostname} promoted to leader (RTO: ${rtoSeconds}s).`,
    };
  }
}

export const failoverEngine = new FailoverEngine();
