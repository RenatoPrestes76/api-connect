import { createHash } from 'node:crypto';
import type { AuditEntry, AuditEvent } from './types.js';

const GENESIS_HASH = '0'.repeat(64);

// ─── Hash computation ─────────────────────────────────────────────────────────

/**
 * Computes the SHA-256 hash of an audit entry.
 * Binds: previousHash, sequence number, event data, and timestamp.
 */
export function computeEntryHash(
  previousHash: string,
  sequence: number,
  event: AuditEvent,
  timestamp: string
): string {
  const data = `${previousHash}:${sequence}:${JSON.stringify(event)}:${timestamp}`;
  return createHash('sha256').update(data).digest('hex');
}

// ─── Chain builder ────────────────────────────────────────────────────────────

/**
 * Appends a new event to the chain and returns the new entry.
 * The chain head is the last entry in entries (by sequence).
 */
export function appendEntry(entries: AuditEntry[], event: AuditEvent): AuditEntry {
  const sorted = [...entries].sort((a, b) => a.sequence - b.sequence);
  const last = sorted[sorted.length - 1];
  const sequence = (last?.sequence ?? 0) + 1;
  const previousHash = last?.hash ?? GENESIS_HASH;
  const timestamp = event.timestamp;
  const id = `audit-${sequence}-${timestamp.slice(0, 10)}`;
  const hash = computeEntryHash(previousHash, sequence, event, timestamp);
  return { id, sequence, hash, previousHash, event, timestamp };
}

// ─── Chain verification ───────────────────────────────────────────────────────

export interface ChainVerificationResult {
  valid: boolean;
  /** Sequence number of the first invalid entry, if any. */
  invalidAt: number | null;
  /** Total entries verified. */
  total: number;
}

/**
 * Verifies the entire hash chain for integrity.
 * Returns false immediately on the first tampered entry.
 */
export function verifyChain(entries: AuditEntry[]): ChainVerificationResult {
  if (entries.length === 0) return { valid: true, invalidAt: null, total: 0 };

  const sorted = [...entries].sort((a, b) => a.sequence - b.sequence);
  let expectedPrevHash = GENESIS_HASH;

  for (const entry of sorted) {
    const expected = computeEntryHash(
      expectedPrevHash,
      entry.sequence,
      entry.event,
      entry.timestamp
    );
    if (entry.hash !== expected) {
      return { valid: false, invalidAt: entry.sequence, total: sorted.length };
    }
    // Also verify the stored previousHash matches what we tracked
    if (entry.previousHash !== expectedPrevHash) {
      return { valid: false, invalidAt: entry.sequence, total: sorted.length };
    }
    expectedPrevHash = entry.hash;
  }

  return { valid: true, invalidAt: null, total: sorted.length };
}

// ─── SIEM export ─────────────────────────────────────────────────────────────

export interface SiemRecord {
  '@timestamp': string;
  'event.action': string;
  'event.category': string;
  'user.name': string;
  'host.ip': string;
  'organization.id': string;
  'log.level': string;
  'hash.sha256': string;
  [key: string]: unknown;
}

/** Converts an AuditEntry to a SIEM-compatible JSON record. */
export function toSiemRecord(entry: AuditEntry): SiemRecord {
  return {
    '@timestamp': entry.event.timestamp,
    'event.action': entry.event.action,
    'event.category': 'iam',
    'user.name': entry.event.actor,
    'host.ip': entry.event.ip,
    'organization.id': entry.event.tenantId,
    'log.level': 'info',
    'hash.sha256': entry.hash,
    'audit.sequence': entry.sequence,
    'audit.resource': entry.event.resource,
    'audit.resourceId': entry.event.resourceId,
  };
}
