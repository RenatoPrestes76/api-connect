/**
 * CloudDispatcher — sends encrypted+compressed batches to Atlas Cloud.
 *
 * Protocol:
 *  POST /api/v1/sync/batches
 *  Headers: Authorization: Bearer <apiKey>
 *           X-Correlation-Id: <correlationId>
 *           X-Tenant-Id: <tenantId>
 *           X-Batch-Id: <batchId>
 *           Content-Type: application/octet-stream
 *           Content-Encoding: gzip | brotli | identity
 *           X-Encryption-IV: <hex>
 *           X-Encryption-Tag: <hex>
 *           X-Key-Id: <keyId>
 *
 * Response 202 Accepted: { serverRef: string, accepted: number, rejected: number }
 */
import type {
  BatchId,
  CorrelationId,
  DispatchResult,
  DispatchTarget,
  EncryptedBatch,
  CompressedBatch,
  SyncResult,
  TenantId,
} from '../types/index.js';
import { syncOk, syncFail, asBatchId } from '../types/index.js';
import { randomUUID } from 'crypto';

export interface DispatchOptions {
  readonly correlationId: CorrelationId;
  readonly tenantId: TenantId;
}

export class CloudDispatcher {
  private readonly _target: DispatchTarget;

  constructor(target: DispatchTarget) {
    this._target = target;
  }

  async dispatch(
    batch: CompressedBatch | EncryptedBatch,
    options: DispatchOptions
  ): Promise<SyncResult<DispatchResult>> {
    const encrypted = 'encrypted' in batch && (batch as EncryptedBatch).encrypted;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this._target.apiKey}`,
      'Content-Type': 'application/octet-stream',
      'X-Correlation-Id': options.correlationId,
      'X-Tenant-Id': options.tenantId,
      'X-Batch-Id': batch.batchId,
      'X-Schema': batch.schema,
      'X-Table': batch.table,
      'X-Record-Count': String(batch.records),
    };

    if (batch.compressed && batch.algorithm !== 'none') {
      headers['Content-Encoding'] = batch.algorithm;
    }

    if (encrypted) {
      const enc = batch as EncryptedBatch;
      headers['X-Encryption-IV'] = enc.iv;
      headers['X-Encryption-Tag'] = enc.authTag;
      headers['X-Key-Id'] = enc.keyId;
    }

    const start = Date.now();

    try {
      const response = await this._fetchWithTimeout(
        `${this._target.url}/api/v1/sync/batches`,
        {
          method: 'POST',
          headers,
          body: batch.payload,
        },
        this._target.timeout
      );

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const retryable = response.status === 429 || response.status >= 500;
        return syncFail(
          `HTTP_${response.status}`,
          `Atlas Cloud rejected batch: ${response.status} ${body.slice(0, 200)}`,
          { retryable, context: { batchId: batch.batchId, status: response.status } }
        );
      }

      const json = (await response.json()) as {
        serverRef?: string;
        accepted?: number;
        rejected?: number;
      };

      return syncOk({
        batchId: batch.batchId,
        accepted: json.accepted ?? batch.records,
        rejected: json.rejected ?? 0,
        serverRef: json.serverRef ?? randomUUID(),
        latencyMs: Date.now() - start,
      });
    } catch (err) {
      const msg = (err as Error).message;
      const retryable = /ECONNRESET|ETIMEDOUT|ECONNREFUSED|fetch failed/i.test(msg);
      return syncFail('NETWORK_ERROR', `Dispatch failed: ${msg}`, {
        retryable,
        cause: err as Error,
        context: { batchId: batch.batchId },
      });
    }
  }

  private async _fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}
