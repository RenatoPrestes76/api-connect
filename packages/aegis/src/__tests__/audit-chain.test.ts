import { describe, it, expect } from 'vitest';
import { computeEntryHash, appendEntry, verifyChain, toSiemRecord } from '../audit-chain.js';
import type { AuditEntry, AuditEvent } from '../types.js';

const makeEvent = (action = 'login', seq = 0): AuditEvent => ({
  action,
  actor: 'user@example.com',
  tenantId: 'tenant-test',
  resource: 'auth',
  resourceId: `res-${seq}`,
  ip: '10.0.0.1',
  result: 'success',
  timestamp: new Date(1_700_000_000_000 + seq * 1000).toISOString(),
});

function buildChain(n: number): AuditEntry[] {
  const entries: AuditEntry[] = [];
  for (let i = 0; i < n; i++) {
    entries.push(appendEntry(entries, makeEvent('login', i)));
  }
  return entries;
}

// ─── computeEntryHash ─────────────────────────────────────────────────────────

describe('computeEntryHash', () => {
  it('returns a 64-char hex string', () => {
    const hash = computeEntryHash('0'.repeat(64), 1, makeEvent(), '2026-01-01T00:00:00Z');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    const ev = makeEvent();
    const ts = ev.timestamp;
    const h1 = computeEntryHash('0'.repeat(64), 1, ev, ts);
    const h2 = computeEntryHash('0'.repeat(64), 1, ev, ts);
    expect(h1).toBe(h2);
  });

  it('changes when sequence changes', () => {
    const ev = makeEvent();
    const h1 = computeEntryHash('0'.repeat(64), 1, ev, ev.timestamp);
    const h2 = computeEntryHash('0'.repeat(64), 2, ev, ev.timestamp);
    expect(h1).not.toBe(h2);
  });
});

// ─── appendEntry ──────────────────────────────────────────────────────────────

describe('appendEntry', () => {
  it('first entry has sequence 1 and genesis previousHash', () => {
    const entry = appendEntry([], makeEvent('login', 0));
    expect(entry.sequence).toBe(1);
    expect(entry.previousHash).toBe('0'.repeat(64));
  });

  it('second entry links to first', () => {
    const first = appendEntry([], makeEvent('login', 0));
    const second = appendEntry([first], makeEvent('logout', 1));
    expect(second.sequence).toBe(2);
    expect(second.previousHash).toBe(first.hash);
  });

  it('chain of 5 has sequential sequence numbers', () => {
    const chain = buildChain(5);
    const seqs = chain.map((e) => e.sequence);
    expect(seqs).toEqual([1, 2, 3, 4, 5]);
  });
});

// ─── verifyChain ──────────────────────────────────────────────────────────────

describe('verifyChain', () => {
  it('empty chain is valid', () => {
    const result = verifyChain([]);
    expect(result.valid).toBe(true);
    expect(result.total).toBe(0);
  });

  it('intact chain of 10 verifies successfully', () => {
    const chain = buildChain(10);
    const result = verifyChain(chain);
    expect(result.valid).toBe(true);
    expect(result.total).toBe(10);
    expect(result.invalidAt).toBeNull();
  });

  it('detects tampering in the middle of the chain', () => {
    const chain = buildChain(5);
    // Tamper with entry at sequence 3
    const tampered = chain.map((e) =>
      e.sequence === 3 ? { ...e, event: { ...e.event, result: 'failure' } } : e
    );
    const result = verifyChain(tampered);
    expect(result.valid).toBe(false);
    expect(result.invalidAt).toBe(3);
  });

  it('detects hash injection (modified hash field)', () => {
    const chain = buildChain(3);
    const tampered = chain.map((e) => (e.sequence === 2 ? { ...e, hash: 'a'.repeat(64) } : e));
    const result = verifyChain(tampered);
    expect(result.valid).toBe(false);
  });
});

// ─── toSiemRecord ──────────────────────────────────────────────────────────────

describe('toSiemRecord', () => {
  it('contains required ECS fields', () => {
    const chain = buildChain(1);
    const record = toSiemRecord(chain[0]!);
    expect(record['@timestamp']).toBeTruthy();
    expect(record['event.action']).toBe('login');
    expect(record['user.name']).toBe('user@example.com');
    expect(record['organization.id']).toBe('tenant-test');
    expect(record['hash.sha256']).toMatch(/^[0-9a-f]{64}$/);
    expect(record['audit.sequence']).toBe(1);
  });
});
