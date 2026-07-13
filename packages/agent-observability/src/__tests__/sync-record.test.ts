import { describe, it, expect } from 'vitest';
import { SyncRecord, SyncRecordError } from '../entity/sync-record.js';

const START = new Date('2025-01-01T10:00:00Z');
const FINISH = new Date('2025-01-01T10:01:30Z');

const base = () => ({
  agentId: 'agent-1',
  startedAt: START,
  finishedAt: FINISH,
  recordsSent: 500,
  recordsFailed: 2,
  bytesTransferred: 204_800,
  result: 'SUCCESS' as const,
});

describe('SyncRecord.create', () => {
  it('creates a record and computes durationMs', () => {
    const r = SyncRecord.create(base());
    expect(r.durationMs).toBe(90_000); // 90 seconds
    expect(r.result).toBe('SUCCESS');
    expect(r.id).toBeDefined();
  });

  it('accepts PARTIAL and FAILED results', () => {
    expect(SyncRecord.create({ ...base(), result: 'PARTIAL' }).result).toBe('PARTIAL');
    expect(SyncRecord.create({ ...base(), result: 'FAILED' }).result).toBe('FAILED');
  });

  it('accepts optional compressionRatio', () => {
    const r = SyncRecord.create({ ...base(), compressionRatio: 0.65 });
    expect(r.compressionRatio).toBe(0.65);
  });

  it('compressionRatio defaults to null', () => {
    expect(SyncRecord.create(base()).compressionRatio).toBeNull();
  });

  it('uses provided id', () => {
    const r = SyncRecord.create({ ...base(), id: 'custom' });
    expect(r.id).toBe('custom');
  });

  it('throws on empty agentId', () => {
    expect(() => SyncRecord.create({ ...base(), agentId: '' })).toThrow(SyncRecordError);
  });

  it('throws when finishedAt is before startedAt', () => {
    expect(() => SyncRecord.create({ ...base(), finishedAt: START, startedAt: FINISH })).toThrow(
      SyncRecordError
    );
  });

  it('throws on negative recordsSent', () => {
    expect(() => SyncRecord.create({ ...base(), recordsSent: -1 })).toThrow(SyncRecordError);
  });

  it('throws on negative bytesTransferred', () => {
    expect(() => SyncRecord.create({ ...base(), bytesTransferred: -1 })).toThrow(SyncRecordError);
  });
});

describe('SyncRecord.fromSnapshot / toSnapshot', () => {
  it('round-trips all fields', () => {
    const r = SyncRecord.create(base());
    const snap = r.toSnapshot();
    const r2 = SyncRecord.fromSnapshot(snap);
    expect(r2.toSnapshot()).toEqual(snap);
  });
});
