import type { HeartbeatRecord } from '../entity/heartbeat-record.js';

export const DEFAULT_MAX_HEARTBEATS_PER_AGENT = 500;

export interface HeartbeatRecordRepository {
  save(record: HeartbeatRecord): Promise<void>;
  findByAgentId(agentId: string, limit?: number): Promise<HeartbeatRecord[]>;
  findRecent(since: Date, limit?: number): Promise<HeartbeatRecord[]>;
  countByAgentId(agentId: string): Promise<number>;
  deleteOldest(agentId: string, keepCount: number): Promise<void>;
}
