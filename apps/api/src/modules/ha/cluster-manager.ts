import type { ClusterNode, ClusterNodeWithReplication, ClusterOverview } from './types.js';
import { haStore } from './ha-store.js';

export class ClusterManager {
  getLeader(): ClusterNodeWithReplication | null {
    return (
      haStore.getNodesWithReplication({ role: 'leader' }).find((n) => n.status !== 'offline') ??
      null
    );
  }

  getAllNodes(): ClusterNodeWithReplication[] {
    return haStore.getNodesWithReplication();
  }

  getActiveNodes(): ClusterNodeWithReplication[] {
    return haStore.getNodesWithReplication().filter((n) => n.status !== 'offline');
  }

  getStandbyNodes(): ClusterNodeWithReplication[] {
    return haStore
      .getNodesWithReplication({ role: 'standby' })
      .filter((n) => n.status !== 'offline');
  }

  getOverview(): ClusterOverview {
    return haStore.getClusterOverview();
  }

  registerNode(
    hostname: string,
    role: ClusterNode['role'],
    region: string,
    version: string
  ): ClusterNode {
    const node = haStore.addNode({
      hostname,
      role,
      status: 'online',
      region,
      version,
      lastHeartbeat: new Date().toISOString(),
    });
    haStore.addHaEvent({
      type: 'node.joined',
      severity: 'info',
      message: `Node ${hostname} joined cluster as ${role}`,
      payload: { nodeId: node.id, region, version },
    });
    return node;
  }

  refreshHeartbeat(nodeId: string): ClusterNode | null {
    return haStore.updateNode(nodeId, { lastHeartbeat: new Date().toISOString() });
  }
}

export const clusterManager = new ClusterManager();
