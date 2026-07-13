/**
 * @seltriva/agent — updates
 * Automatic update management with signature verification and rollback.
 *
 * Update flow:
 *   1. UpdateChecker polls the update server for new versions
 *   2. New version manifest is downloaded and signature verified
 *   3. Update package is downloaded and checksum validated
 *   4. Package signature is verified against trusted keys
 *   5. Current installation is backed up (if configured)
 *   6. Update is applied atomically
 *   7. Agent is restarted via ProcessManager
 *   8. On failure, automatic rollback restores backup
 *
 * Security invariants:
 *   - Update manifests must carry a valid Ed25519 signature
 *   - Packages are verified before extraction
 *   - Rollback is available for the last N versions
 */

import type { AgentResult, AgentId } from '../configuration/index';
import type { UpdateChannel } from '../configuration/index';

// ─── Update Manager ───────────────────────────────────────────────────────

export interface UpdateManager {
  /**
   * Check for available updates
   */
  checkForUpdates(): Promise<AgentResult<UpdateCheckResult>>;

  /**
   * Download a specific version
   */
  download(version: string): Promise<AgentResult<DownloadedUpdate>>;

  /**
   * Apply a downloaded update
   */
  apply(update: DownloadedUpdate): Promise<AgentResult<void>>;

  /**
   * Check, download, and apply in one operation
   */
  updateToLatest(): Promise<AgentResult<UpdateResult>>;

  /**
   * Roll back to the previous version
   */
  rollback(): Promise<AgentResult<void>>;

  /**
   * List versions available for rollback
   */
  listRollbackTargets(): RollbackTarget[];

  /**
   * Get the current installed version
   */
  getCurrentVersion(): string;

  /**
   * Get update history
   */
  getHistory(): UpdateHistoryEntry[];

  /**
   * Subscribe to update events
   */
  onEvent(handler: UpdateEventHandler): UpdateEventSubscription;
}

// ─── Update Manifest ──────────────────────────────────────────────────────

export interface UpdateManifest {
  readonly version: string;
  readonly channel: UpdateChannel;
  readonly releasedAt: Date;
  readonly minimumVersion: string;
  readonly breakingChanges: boolean;
  readonly changelog: string;
  readonly packages: UpdatePackageRef[];
  readonly signature: string;
  readonly signingKeyId: string;
}

export interface UpdatePackageRef {
  readonly platform: NodePlatform;
  readonly arch: NodeArch;
  readonly url: string;
  readonly sha256: string;
  readonly sizeBytes: number;
}

export type NodePlatform = 'win32' | 'darwin' | 'linux';
export type NodeArch = 'x64' | 'arm64';

// ─── Downloaded Update ────────────────────────────────────────────────────

export interface DownloadedUpdate {
  readonly version: string;
  readonly manifest: UpdateManifest;
  readonly localPath: string;
  readonly sha256: string;
  readonly downloadedAt: Date;
  readonly signatureVerified: boolean;
  readonly checksumVerified: boolean;
}

// ─── Update Check Result ──────────────────────────────────────────────────

export interface UpdateCheckResult {
  readonly currentVersion: string;
  readonly latestVersion: string;
  readonly updateAvailable: boolean;
  readonly isBreakingChange: boolean;
  readonly manifest?: UpdateManifest;
  readonly checkedAt: Date;
}

// ─── Update Result ────────────────────────────────────────────────────────

export interface UpdateResult {
  readonly previousVersion: string;
  readonly newVersion: string;
  readonly status: UpdateStatus;
  readonly error?: string;
  readonly rolledBack?: boolean;
  readonly appliedAt: Date;
}

export type UpdateStatus =
  | 'already-up-to-date'
  | 'updated'
  | 'update-failed'
  | 'rollback-applied'
  | 'rollback-failed';

// ─── Rollback ─────────────────────────────────────────────────────────────

export interface RollbackTarget {
  readonly version: string;
  readonly backupPath: string;
  readonly backedUpAt: Date;
  readonly sizeBytes: number;
}

// ─── Update Checker ───────────────────────────────────────────────────────

export interface UpdateChecker {
  /**
   * Fetch the latest manifest from the update server
   */
  fetchManifest(channel: UpdateChannel): Promise<AgentResult<UpdateManifest>>;

  /**
   * Compare current version to manifest
   */
  compare(currentVersion: string, manifest: UpdateManifest): UpdateComparisonResult;
}

export interface UpdateComparisonResult {
  readonly needsUpdate: boolean;
  readonly isBreakingChange: boolean;
  readonly canAutoUpdate: boolean;
  readonly reason?: string;
}

// ─── Update Downloader ────────────────────────────────────────────────────

export interface UpdateDownloader {
  /**
   * Download a package to the local cache
   */
  download(
    ref: UpdatePackageRef,
    onProgress?: DownloadProgressHandler
  ): Promise<AgentResult<DownloadedUpdate>>;

  /**
   * Verify the SHA-256 checksum of a downloaded file
   */
  verifyChecksum(filePath: string, expectedSha256: string): Promise<boolean>;
}

export type DownloadProgressHandler = (downloaded: number, total: number, percent: number) => void;

// ─── Update Applier ───────────────────────────────────────────────────────

export interface UpdateApplier {
  /**
   * Back up the current installation to a restore point
   */
  backup(targetDir: string): Promise<AgentResult<string>>;

  /**
   * Extract and apply an update package
   */
  apply(update: DownloadedUpdate, agentId: AgentId): Promise<AgentResult<void>>;

  /**
   * Restore from a backup
   */
  restore(backupPath: string): Promise<AgentResult<void>>;
}

// ─── Update History ───────────────────────────────────────────────────────

export interface UpdateHistoryEntry {
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly status: UpdateStatus;
  readonly channel: UpdateChannel;
  readonly appliedAt: Date;
  readonly error?: string;
  readonly autoApplied: boolean;
}

// ─── Update Events ────────────────────────────────────────────────────────

export type UpdateEventKind =
  | 'update-available'
  | 'download-started'
  | 'download-progress'
  | 'download-completed'
  | 'signature-verified'
  | 'applying'
  | 'update-completed'
  | 'update-failed'
  | 'rollback-started'
  | 'rollback-completed'
  | 'rollback-failed';

export interface UpdateEvent {
  readonly kind: UpdateEventKind;
  readonly version?: string;
  readonly progress?: number;
  readonly error?: string;
  readonly timestamp: Date;
}

export type UpdateEventHandler = (event: UpdateEvent) => void;

export interface UpdateEventSubscription {
  unsubscribe(): void;
}
