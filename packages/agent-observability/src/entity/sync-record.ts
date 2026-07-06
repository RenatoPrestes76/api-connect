import { randomUUID } from 'node:crypto';

export type SyncResult = 'SUCCESS' | 'PARTIAL' | 'FAILED';

export interface SyncRecordSnapshot {
  readonly id:               string;
  readonly agentId:          string;
  readonly startedAt:        Date;
  readonly finishedAt:       Date;
  readonly durationMs:       number;
  readonly recordsSent:      number;
  readonly recordsFailed:    number;
  readonly bytesTransferred: number;
  readonly compressionRatio: number | null;
  readonly result:           SyncResult;
}

export class SyncRecord {
  private constructor(private readonly _s: SyncRecordSnapshot) {}

  static create(params: {
    agentId:           string;
    startedAt:         Date;
    finishedAt:        Date;
    recordsSent:       number;
    recordsFailed:     number;
    bytesTransferred:  number;
    compressionRatio?: number | null;
    result:            SyncResult;
    id?:               string;
  }): SyncRecord {
    if (!params.agentId?.trim())  throw new SyncRecordError('agentId is required');
    if (params.finishedAt < params.startedAt) throw new SyncRecordError('finishedAt must be after startedAt');
    if (params.recordsSent    < 0) throw new SyncRecordError('recordsSent cannot be negative');
    if (params.recordsFailed  < 0) throw new SyncRecordError('recordsFailed cannot be negative');
    if (params.bytesTransferred < 0) throw new SyncRecordError('bytesTransferred cannot be negative');
    return new SyncRecord({
      id:               params.id ?? randomUUID(),
      agentId:          params.agentId,
      startedAt:        params.startedAt,
      finishedAt:       params.finishedAt,
      durationMs:       params.finishedAt.getTime() - params.startedAt.getTime(),
      recordsSent:      params.recordsSent,
      recordsFailed:    params.recordsFailed,
      bytesTransferred: params.bytesTransferred,
      compressionRatio: params.compressionRatio ?? null,
      result:           params.result,
    });
  }

  static fromSnapshot(snap: SyncRecordSnapshot): SyncRecord {
    return new SyncRecord(snap);
  }

  toSnapshot(): SyncRecordSnapshot {
    return { ...this._s };
  }

  get id():               string        { return this._s.id; }
  get agentId():          string        { return this._s.agentId; }
  get startedAt():        Date          { return this._s.startedAt; }
  get finishedAt():       Date          { return this._s.finishedAt; }
  get durationMs():       number        { return this._s.durationMs; }
  get recordsSent():      number        { return this._s.recordsSent; }
  get recordsFailed():    number        { return this._s.recordsFailed; }
  get bytesTransferred(): number        { return this._s.bytesTransferred; }
  get compressionRatio(): number | null { return this._s.compressionRatio; }
  get result():           SyncResult    { return this._s.result; }
}

export class SyncRecordError extends Error {
  readonly code = 'SYNC_RECORD_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'SyncRecordError';
  }
}
