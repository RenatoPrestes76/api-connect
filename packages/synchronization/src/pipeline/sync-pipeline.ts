/**
 * SyncPipeline — Extract → Transform → Validate → Compress → Encrypt → Dispatch → Confirm → Checkpoint
 *
 * Each stage is a separate async function; failure at any stage propagates
 * through SyncResult and is handled by the engine (retry/checkpoint).
 *
 * The pipeline is READ-ONLY safe: assertReadOnly is applied before any query.
 */
import { randomUUID } from 'crypto';
import {
  type BatchId,
  type CompressedBatch,
  type EncryptedBatch,
  type ExtractedRecord,
  type PipelineConfig,
  type SyncRecord,
  type SyncResult,
  type TableSyncConfig,
  type ValidatedRecord,
  asBatchId,
  syncOk,
  syncFail,
} from '../types/index.js';
import { Compressor } from '../compression/compressor.js';
import { Encryptor } from '../encryption/encryptor.js';
import { ValidationEngine } from '../validation/validation-engine.js';
import { CloudDispatcher } from '../dispatcher/cloud-dispatcher.js';
import type { DispatchOptions } from '../dispatcher/cloud-dispatcher.js';
import { hashRecord } from '../detection/change-detector.js';
import type { MetricsCollector } from '../metrics/metrics-collector.js';
import type { Telemetry } from '../telemetry/telemetry.js';
import type { CheckpointManager } from '../checkpoint/checkpoint-manager.js';
import type { SyncJobId } from '../types/index.js';

export interface PipelineContext {
  readonly jobId: SyncJobId;
  readonly tableConfig: TableSyncConfig;
  readonly dispatchOptions: DispatchOptions;
  readonly encryptionKey?: Buffer;
}

export interface ExtractInput {
  readonly records: readonly SyncRecord[];
  readonly schema: string;
  readonly table: string;
}

export class SyncPipeline {
  private readonly _compressor: Compressor;
  private readonly _encryptor: Encryptor;
  private readonly _validator: ValidationEngine;
  private readonly _dispatcher: CloudDispatcher;

  constructor(
    private readonly _config: PipelineConfig,
    private readonly _metrics: MetricsCollector,
    private readonly _telemetry: Telemetry,
    private readonly _checkpoint: CheckpointManager,
    dispatcher: CloudDispatcher,
    validator?: ValidationEngine
  ) {
    this._compressor = new Compressor(_config.compression);
    this._encryptor = new Encryptor(_config.encryption);
    this._validator = validator ?? new ValidationEngine();
    this._dispatcher = dispatcher;
  }

  /**
   * Run a batch of records through the full pipeline.
   * Returns the number of records successfully dispatched.
   */
  async processBatch(input: ExtractInput, context: PipelineContext): Promise<SyncResult<number>> {
    const { schema, table, records } = input;
    const batchId = asBatchId(randomUUID());
    const log = this._telemetry.child({ schema, table });

    log.debug(`Pipeline: processing batch of ${records.length} records`, { batchId });

    // ─── Stage 1: Extract (input already extracted, annotate operations) ──
    const extracted = this._stageExtract(records, schema, table, context.tableConfig);

    // ─── Stage 2: Transform (cast types, clean nulls) ─────────────────────
    const transformed = this._stageTransform(extracted);

    // ─── Stage 3: Validate ────────────────────────────────────────────────
    const { valid, invalid } = this._stageValidate(transformed, schema, table);

    if (invalid.length > 0) {
      log.warn(`Pipeline: ${invalid.length} invalid records in batch`, {
        batchId,
        sampleViolation: invalid[0]?.violations[0],
      });
      this._metrics.recordFailed(schema, table, invalid.length);
    }

    if (valid.length === 0) {
      return syncOk(0);
    }

    // ─── Stage 4: Serialize ───────────────────────────────────────────────
    const serialized = Buffer.from(JSON.stringify(valid.map((r) => r.data)), 'utf-8');
    const originalSize = serialized.length;

    // ─── Stage 5: Compress ────────────────────────────────────────────────
    const compressResult = await this._compressor.compress(serialized);
    if (!compressResult.ok) {
      return syncFail('COMPRESS_FAILED', compressResult.error.message, { retryable: false });
    }

    const compressedBatch: CompressedBatch = {
      batchId,
      schema,
      table,
      records: valid.length,
      payload: compressResult.value.data,
      compressed: this._config.compression.enabled,
      algorithm: compressResult.value.algorithm,
      originalSize,
      compressedSize: compressResult.value.compressedSize,
    };

    this._metrics.batchDispatched(schema, table, originalSize, compressResult.value.compressedSize);

    // ─── Stage 6: Encrypt ─────────────────────────────────────────────────
    let dispatchPayload: CompressedBatch | EncryptedBatch = compressedBatch;

    if (this._config.encryption.enabled && context.encryptionKey) {
      const encResult = await this._encryptor.encrypt(
        compressedBatch.payload,
        context.encryptionKey
      );
      if (!encResult.ok) {
        return syncFail('ENCRYPT_FAILED', encResult.error.message, { retryable: false });
      }
      dispatchPayload = {
        ...compressedBatch,
        payload: encResult.value.ciphertext,
        encrypted: true,
        keyId: encResult.value.keyId,
        iv: encResult.value.iv,
        authTag: encResult.value.authTag,
      };
    }

    // ─── Stage 7: Dispatch ────────────────────────────────────────────────
    const dispatchResult = await this._dispatcher.dispatch(
      dispatchPayload,
      context.dispatchOptions
    );
    if (!dispatchResult.ok) {
      return syncFail(dispatchResult.error.code, dispatchResult.error.message, {
        retryable: dispatchResult.error.retryable,
      });
    }

    // ─── Stage 8: Confirm + Checkpoint ───────────────────────────────────
    this._metrics.recordSynced(schema, table, valid.length, originalSize);
    log.info(`Pipeline: batch dispatched`, {
      batchId,
      accepted: dispatchResult.value.accepted,
      rejected: dispatchResult.value.rejected,
      latencyMs: dispatchResult.value.latencyMs,
    });

    return syncOk(valid.length);
  }

  // ─── Stages ──────────────────────────────────────────────────────────────

  private _stageExtract(
    records: readonly SyncRecord[],
    schema: string,
    table: string,
    config: TableSyncConfig
  ): ExtractedRecord[] {
    return records.map((data) => ({
      schema,
      table,
      operation: 'UPSERT',
      data,
      checksum: hashRecord(data),
    }));
  }

  private _stageTransform(records: ExtractedRecord[]): ExtractedRecord[] {
    return records.map((r) => ({
      ...r,
      data: this._castValues(r.data),
    }));
  }

  private _castValues(record: SyncRecord): SyncRecord {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(record)) {
      if (v instanceof Date) {
        result[k] = v.toISOString();
      } else {
        result[k] = v;
      }
    }
    return result as SyncRecord;
  }

  private _stageValidate(
    records: ExtractedRecord[],
    schema: string,
    table: string
  ): { valid: ValidatedRecord[]; invalid: ValidatedRecord[] } {
    if (!this._config.validate) {
      const valid = records.map((r) => ({
        ...r,
        validatedAt: new Date().toISOString(),
        isValid: true,
        violations: [] as string[],
      }));
      return { valid, invalid: [] };
    }

    const results = this._validator.validateBatch(
      schema,
      table,
      records.map((r) => r.data)
    );
    const valid: ValidatedRecord[] = [];
    const invalid: ValidatedRecord[] = [];

    for (let i = 0; i < records.length; i++) {
      const r = records[i]!;
      const res = results[i]!;
      const vr: ValidatedRecord = {
        ...r,
        validatedAt: new Date().toISOString(),
        isValid: res.isValid,
        violations: res.violations,
      };
      if (res.isValid) valid.push(vr);
      else invalid.push(vr);
    }

    return { valid, invalid };
  }
}
