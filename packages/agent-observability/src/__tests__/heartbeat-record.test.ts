import { describe, it, expect } from 'vitest';
import { HeartbeatRecord, HeartbeatRecordError } from '../entity/heartbeat-record.js';

const SNAP = () => ({
  id: 'hb-1',
  agentId: 'agent-1',
  receivedAt: new Date('2025-01-01T10:00:00Z'),
  version: '1.2.3',
  hostname: 'srv01.local',
  memoryUsage: 512,
  uptime: 3600,
  queueSize: 4,
  status: 'ONLINE',
});

describe('HeartbeatRecord.create', () => {
  it('creates a record with all fields', () => {
    const r = HeartbeatRecord.create({
      agentId: 'agent-1', receivedAt: new Date(), version: '1.0.0',
      hostname: 'host.local', status: 'ONLINE',
    });
    expect(r.agentId).toBe('agent-1');
    expect(r.status).toBe('ONLINE');
    expect(r.id).toBeDefined();
    expect(r.memoryUsage).toBeNull();
  });

  it('accepts optional numeric fields', () => {
    const r = HeartbeatRecord.create({
      agentId: 'ag-2', receivedAt: new Date(), version: '2.0.0',
      hostname: 'h.local', status: 'ONLINE',
      memoryUsage: 1024, uptime: 7200, queueSize: 0,
    });
    expect(r.memoryUsage).toBe(1024);
    expect(r.uptime).toBe(7200);
    expect(r.queueSize).toBe(0);
  });

  it('uses provided id', () => {
    const r = HeartbeatRecord.create({
      id: 'custom-id', agentId: 'ag', receivedAt: new Date(),
      version: '1.0.0', hostname: 'h', status: 'ONLINE',
    });
    expect(r.id).toBe('custom-id');
  });

  it('throws on empty agentId', () => {
    expect(() => HeartbeatRecord.create({
      agentId: '', receivedAt: new Date(), version: '1.0.0', hostname: 'h', status: 'ONLINE',
    })).toThrow(HeartbeatRecordError);
  });

  it('throws on empty version', () => {
    expect(() => HeartbeatRecord.create({
      agentId: 'ag', receivedAt: new Date(), version: '', hostname: 'h', status: 'ONLINE',
    })).toThrow(HeartbeatRecordError);
  });

  it('throws on empty hostname', () => {
    expect(() => HeartbeatRecord.create({
      agentId: 'ag', receivedAt: new Date(), version: '1.0.0', hostname: '', status: 'ONLINE',
    })).toThrow(HeartbeatRecordError);
  });
});

describe('HeartbeatRecord.fromSnapshot / toSnapshot', () => {
  it('round-trips all fields', () => {
    const snap = SNAP();
    const r = HeartbeatRecord.fromSnapshot(snap);
    expect(r.toSnapshot()).toEqual(snap);
  });

  it('fromSnapshot accepts null optional fields', () => {
    const r = HeartbeatRecord.fromSnapshot({ ...SNAP(), memoryUsage: null, uptime: null, queueSize: null });
    expect(r.memoryUsage).toBeNull();
  });
});
