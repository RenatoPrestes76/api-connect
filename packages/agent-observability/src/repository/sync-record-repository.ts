import type { SyncRecord } from '../entity/sync-record.js';

export const DEFAULT_MAX_SYNCS_PER_AGENT = 500;

export interface SyncRecordRepository {
  save(record: SyncRecord): Promise<void>;
  findByAgentId(agentId: string, limit?: number): Promise<SyncRecord[]>;
  findRecent(since: Date, limit?: number): Promise<SyncRecord[]>;
  countByAgentId(agentId: string): Promise<number>;
  deleteOldest(agentId: string, keepCount: number): Promise<void>;
}
