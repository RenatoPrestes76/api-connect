import { randomUUID } from 'node:crypto';

export interface HeartbeatRecordSnapshot {
  readonly id:          string;
  readonly agentId:     string;
  readonly receivedAt:  Date;
  readonly version:     string;
  readonly hostname:    string;
  readonly memoryUsage: number | null;
  readonly uptime:      number | null;
  readonly queueSize:   number | null;
  readonly status:      string;
}

export class HeartbeatRecord {
  private constructor(private readonly _s: HeartbeatRecordSnapshot) {}

  static create(params: {
    agentId:      string;
    receivedAt:   Date;
    version:      string;
    hostname:     string;
    memoryUsage?: number | null;
    uptime?:      number | null;
    queueSize?:   number | null;
    status:       string;
    id?:          string;
  }): HeartbeatRecord {
    if (!params.agentId?.trim()) throw new HeartbeatRecordError('agentId is required');
    if (!params.version?.trim()) throw new HeartbeatRecordError('version is required');
    if (!params.hostname?.trim()) throw new HeartbeatRecordError('hostname is required');
    return new HeartbeatRecord({
      id:          params.id ?? randomUUID(),
      agentId:     params.agentId,
      receivedAt:  params.receivedAt,
      version:     params.version,
      hostname:    params.hostname,
      memoryUsage: params.memoryUsage ?? null,
      uptime:      params.uptime ?? null,
      queueSize:   params.queueSize ?? null,
      status:      params.status,
    });
  }

  static fromSnapshot(snap: HeartbeatRecordSnapshot): HeartbeatRecord {
    return new HeartbeatRecord(snap);
  }

  toSnapshot(): HeartbeatRecordSnapshot {
    return { ...this._s };
  }

  get id():          string        { return this._s.id; }
  get agentId():     string        { return this._s.agentId; }
  get receivedAt():  Date          { return this._s.receivedAt; }
  get version():     string        { return this._s.version; }
  get hostname():    string        { return this._s.hostname; }
  get memoryUsage(): number | null { return this._s.memoryUsage; }
  get uptime():      number | null { return this._s.uptime; }
  get queueSize():   number | null { return this._s.queueSize; }
  get status():      string        { return this._s.status; }
}

export class HeartbeatRecordError extends Error {
  readonly code = 'HEARTBEAT_RECORD_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'HeartbeatRecordError';
  }
}
