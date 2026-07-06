/**
 * Minimal Prisma model types for agent-observability.
 * Mirrors what `prisma generate` produces for AtlasAgentHeartbeat and
 * AtlasAgentSyncHistory in schema.prisma.
 */

// ─── AtlasAgentHeartbeat ─────────────────────────────────────────────────────

export interface PrismaAtlasAgentHeartbeat {
  id:          string;
  agentId:     string;
  receivedAt:  Date;
  version:     string;
  hostname:    string;
  memoryUsage: number | null;
  uptime:      number | null;
  queueSize:   number | null;
  status:      string;
}

export type PrismaAtlasAgentHeartbeatCreate = Omit<PrismaAtlasAgentHeartbeat, 'receivedAt'> & { receivedAt?: Date };

export interface HeartbeatDbDelegate {
  create(args: { data: PrismaAtlasAgentHeartbeatCreate }): Promise<PrismaAtlasAgentHeartbeat>;
  findMany(args: {
    where?:   { agentId?: string; receivedAt?: { gte?: Date } };
    orderBy?: { receivedAt?: 'asc' | 'desc' };
    take?:    number;
  }): Promise<PrismaAtlasAgentHeartbeat[]>;
  count(args: { where?: { agentId?: string } }): Promise<number>;
  deleteMany(args: {
    where: { id: { in: string[] } };
  }): Promise<{ count: number }>;
}

// ─── AtlasAgentSyncHistory ───────────────────────────────────────────────────

export interface PrismaAtlasAgentSyncHistory {
  id:               string;
  agentId:          string;
  startedAt:        Date;
  finishedAt:       Date;
  durationMs:       number;
  recordsSent:      number;
  recordsFailed:    number;
  bytesTransferred: number;
  compressionRatio: number | null;
  result:           string;
}

export type PrismaAtlasAgentSyncHistoryCreate = PrismaAtlasAgentSyncHistory;

export interface SyncHistoryDbDelegate {
  create(args: { data: PrismaAtlasAgentSyncHistoryCreate }): Promise<PrismaAtlasAgentSyncHistory>;
  findMany(args: {
    where?:   { agentId?: string; finishedAt?: { gte?: Date } };
    orderBy?: { finishedAt?: 'asc' | 'desc' };
    take?:    number;
  }): Promise<PrismaAtlasAgentSyncHistory[]>;
  count(args: { where?: { agentId?: string } }): Promise<number>;
  deleteMany(args: {
    where: { id: { in: string[] } };
  }): Promise<{ count: number }>;
}

// ─── Combined client interface ────────────────────────────────────────────────

export interface ObservabilityDbClient {
  atlasAgentHeartbeat:   HeartbeatDbDelegate;
  atlasAgentSyncHistory: SyncHistoryDbDelegate;
}
