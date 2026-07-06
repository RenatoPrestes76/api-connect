/**
 * @seltriva/core/sync
 * Synchronization interfaces — Strategy Pattern for sync modes
 */

// ─── Engine ────────────────────────────────────────────────────────────────

/**
 * Orchestrates synchronization between sources and targets
 */
export interface SyncEngine {
  start(): Promise<void>;
  stop(): Promise<void>;
  sync(sourceId: string): Promise<SyncResult>;
  syncBatch(sourceIds: string[]): Promise<SyncResult[]>;
  isSyncing(): boolean;
  getStatus(sourceId: string): SyncStatus | null;
  getHistory(sourceId: string, limit?: number): Promise<SyncHistory[]>;
  registerStrategy(mode: string, strategy: SyncStrategy): void;
}

// ─── Result / Status ───────────────────────────────────────────────────────

export interface SyncResult {
  readonly id: string;
  readonly sourceId: string;
  readonly status: 'success' | 'partial' | 'failed';
  readonly recordsProcessed: number;
  readonly recordsCreated: number;
  readonly recordsUpdated: number;
  readonly recordsDeleted: number;
  readonly recordsFailed: number;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly duration: number;
  readonly errors?: SyncError[];
}

export interface SyncError {
  readonly record: unknown;
  readonly error: string;
  readonly code: string;
}

export interface SyncStatus {
  readonly sourceId: string;
  readonly status: 'idle' | 'syncing' | 'paused' | 'error';
  readonly progress: number;
  readonly lastSyncTime?: Date;
  readonly nextSyncTime?: Date;
  readonly currentOperation?: string;
  readonly errorMessage?: string;
}

export interface SyncHistory {
  readonly id: string;
  readonly sourceId: string;
  readonly syncTime: Date;
  readonly duration: number;
  readonly recordsProcessed: number;
  readonly status: 'success' | 'partial' | 'failed';
}

// ─── Strategy ──────────────────────────────────────────────────────────────

/**
 * Strategy for a specific sync mode (full, incremental, delta, batch, stream)
 */
export interface SyncStrategy {
  execute(context: SyncContext): Promise<SyncResult>;
  getName(): string;
  validate(): Promise<boolean>;
}

export interface SyncContext {
  readonly source: SyncSource;
  readonly target: SyncTarget;
  readonly mapper: unknown; // Mapper — typed as unknown to avoid cross-module coupling
  readonly config: SyncConfiguration;
  readonly logger: unknown;
}

export interface SyncSource {
  readonly id: string;
  readonly type: string;
  readonly driver: unknown; // Driver
  readonly query?: string;
  readonly filters?: Record<string, unknown>;
}

export interface SyncTarget {
  readonly id: string;
  readonly type: string;
  readonly driver: unknown; // Driver
  readonly entity: string;
}

export interface SyncConfiguration {
  readonly mode: 'full' | 'incremental' | 'delta' | 'batch' | 'stream';
  readonly batchSize?: number;
  readonly conflictResolution: 'source' | 'target' | 'merge' | 'custom';
  readonly deleteOrphans: boolean;
  readonly includeHistory: boolean;
  readonly retryOnFailure: boolean;
  readonly maxRetries?: number;
  readonly timeout?: number;
}

// ─── Conflict Resolution ───────────────────────────────────────────────────

export interface ConflictResolver {
  resolve(source: unknown, target: unknown, mode: string): Promise<unknown>;
  registerHandler(
    mode: string,
    handler: (source: unknown, target: unknown) => Promise<unknown>
  ): void;
}

// ─── Change Data Capture ───────────────────────────────────────────────────

/**
 * Streams or polls database-level change events
 */
export interface ChangeDataCapture {
  start(): Promise<void>;
  stop(): Promise<void>;
  getChanges(since: Date): Promise<DataChange[]>;
  getEntityChanges(entity: string, since: Date): Promise<DataChange[]>;
  subscribe(handler: (change: DataChange) => Promise<void>): string;
  unsubscribe(subscriptionId: string): boolean;
}

export interface DataChange {
  readonly id: string;
  readonly entity: string;
  readonly entityId: string;
  readonly operation: 'create' | 'update' | 'delete';
  readonly timestamp: Date;
  readonly beforeValues?: Record<string, unknown>;
  readonly afterValues?: Record<string, unknown>;
  readonly changes?: FieldChange[];
}

export interface FieldChange {
  readonly fieldName: string;
  readonly beforeValue: unknown;
  readonly afterValue: unknown;
}

// ─── Scheduler ─────────────────────────────────────────────────────────────

/**
 * Schedules periodic sync jobs
 */
export interface SyncScheduler {
  schedule(sourceId: string, cronExpression: string): void;
  unschedule(sourceId: string): void;
  getNextRun(sourceId: string): Date | null;
  getScheduledJobs(): SyncJob[];
  pauseAll(): void;
  resumeAll(): void;
}

export interface SyncJob {
  readonly sourceId: string;
  readonly cronExpression: string;
  readonly nextRun: Date | null;
  readonly lastRun?: Date;
  readonly status: 'active' | 'paused';
}
