/**
 * Persistent, idempotent queue for discovery-job results that failed to
 * reach the Atlas cloud (network down, cloud unreachable, process
 * restarted mid-flight) — Sprint A2. Before this existed, a failed
 * `submitResult` was lost outright (`run.ts`'s best-effort
 * `.catch(() => undefined)`), past whatever `client.ts`'s in-request
 * `withRetry()` already covers.
 *
 * Backed by `better-sqlite3` — synchronous, no async-driver footguns for
 * what is a tiny local file nobody else writes to concurrently. One row
 * per job result, keyed by the job's own `requestId`: re-enqueuing the
 * same `requestId` (e.g. the sync cycle picks up the same still-pending
 * job again) replaces the row instead of duplicating it, and the cloud
 * side is independently idempotent per `requestId` too — apps/api's
 * `erp-metadata-store.ts`'s `reportSchema()` detects a request already in
 * a terminal status and returns `reused: true` without reprocessing it
 * (see apps/api/src/modules/erp-metadata/erp-metadata-store.ts:183-184).
 * A resend that overlaps with a delivery the client just never got an ack
 * for is therefore safe on both ends, not a duplicate.
 */
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { SubmitResultInput } from './client.js';

export interface PendingResult {
  requestId: string;
  payload: SubmitResultInput;
  createdAt: string;
  attempts: number;
  lastError: string | null;
}

interface PendingResultRow {
  request_id: string;
  payload: string;
  created_at: string;
  attempts: number;
  last_error: string | null;
}

export class OfflineQueue {
  private readonly _db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this._db = new Database(dbPath);
    this._db.pragma('journal_mode = WAL');
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS pending_results (
        request_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      )
    `);
  }

  /** Idempotent by `payload.requestId` — enqueuing the same job twice replaces the row, never duplicates it. */
  enqueue(payload: SubmitResultInput): void {
    this._db
      .prepare(
        `INSERT INTO pending_results (request_id, payload, created_at, attempts, last_error)
         VALUES (@requestId, @payload, @createdAt, 0, NULL)
         ON CONFLICT(request_id) DO UPDATE SET payload = excluded.payload`
      )
      .run({
        requestId: payload.requestId,
        payload: JSON.stringify(payload),
        createdAt: new Date().toISOString(),
      });
  }

  listPending(): PendingResult[] {
    const rows = this._db
      .prepare(
        `SELECT request_id, payload, created_at, attempts, last_error
         FROM pending_results ORDER BY created_at ASC`
      )
      .all() as PendingResultRow[];
    return rows.map((r) => ({
      requestId: r.request_id,
      payload: JSON.parse(r.payload) as SubmitResultInput,
      createdAt: r.created_at,
      attempts: r.attempts,
      lastError: r.last_error,
    }));
  }

  /** Call once a pending entry has been successfully delivered (acked by the cloud). */
  markDelivered(requestId: string): void {
    this._db.prepare(`DELETE FROM pending_results WHERE request_id = ?`).run(requestId);
  }

  /** Call when a resend attempt still fails — keeps the entry queued, records why. */
  recordFailure(requestId: string, error: string): void {
    this._db
      .prepare(
        `UPDATE pending_results SET attempts = attempts + 1, last_error = ? WHERE request_id = ?`
      )
      .run(error, requestId);
  }

  /** Drops entries older than `maxAgeMs` — a job result nobody could deliver in days is operator-visible via logs, not retried forever. */
  pruneOlderThan(maxAgeMs: number): number {
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
    const result = this._db.prepare(`DELETE FROM pending_results WHERE created_at < ?`).run(cutoff);
    return result.changes;
  }

  size(): number {
    const row = this._db.prepare(`SELECT COUNT(*) as count FROM pending_results`).get() as {
      count: number;
    };
    return row.count;
  }

  close(): void {
    this._db.close();
  }
}
