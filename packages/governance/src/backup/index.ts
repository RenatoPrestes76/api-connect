/**
 * @seltriva/governance — backup
 *
 * Backup governance architecture: policy definitions, job scheduling,
 * target specifications, and integrity verification.
 *
 * This is architecture only — no backup engine implementation.
 * Concrete backup jobs are executed by the platform runtime.
 */

import type { GovernanceResult } from '../policies/index';

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };
export type BackupPolicyId = Branded<string, 'BackupPolicyId'>;
export type BackupJobId    = Branded<string, 'BackupJobId'>;
export type BackupSetId    = Branded<string, 'BackupSetId'>;

// ─── Backup Policy ───────────────────────────────────────────────────────────

export type BackupFrequency  = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'continuous';
export type BackupType       = 'full' | 'incremental' | 'differential' | 'snapshot';
export type BackupEncryption = 'none' | 'aes-256' | 'customer-managed';
export type BackupStatus     = 'pending' | 'running' | 'completed' | 'failed' | 'partial' | 'expired';
export type BackupTargetType = 'database' | 'storage' | 'config' | 'secrets' | 'audit-logs' | 'custom';

export interface BackupPolicy {
  readonly id: BackupPolicyId;
  readonly name: string;
  readonly description?: string;
  readonly organizationId?: string;
  readonly targets: BackupTarget[];
  readonly schedule: BackupSchedule;
  readonly retention: BackupRetention;
  readonly encryption: BackupEncryption;
  readonly compressionEnabled: boolean;
  readonly verifyAfterBackup: boolean;
  readonly destinationId: string;           // storage destination reference
  readonly notificationChannels: string[];
  readonly enabled: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface BackupTarget {
  readonly id: string;
  readonly type: BackupTargetType;
  readonly name: string;
  readonly identifier: string;              // connection string, bucket, etc.
  readonly backupType: BackupType;
  readonly priority: number;
}

export interface BackupSchedule {
  readonly frequency: BackupFrequency;
  readonly cron?: string;                   // custom cron expression
  readonly timezone: string;
  readonly startTime?: string;              // "HH:MM"
  readonly maxDurationMinutes?: number;
}

export interface BackupRetention {
  readonly keepLast: number;
  readonly keepDailyForDays: number;
  readonly keepWeeklyForWeeks: number;
  readonly keepMonthlyForMonths: number;
  readonly keepYearlyForYears: number;
  readonly maxSizeGb?: number;
}

// ─── Backup Job ──────────────────────────────────────────────────────────────

export interface BackupJob {
  readonly id: BackupJobId;
  readonly policyId: BackupPolicyId;
  readonly setId?: BackupSetId;             // groups related jobs
  readonly organizationId?: string;
  readonly status: BackupStatus;
  readonly type: BackupType;
  readonly targets: string[];               // target IDs covered
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly sizeBytes?: number;
  readonly compressedSizeBytes?: number;
  readonly checksums: Record<string, string>;  // targetId → SHA-256
  readonly verified: boolean;
  readonly error?: string;
  readonly location?: string;               // storage location URI
  readonly expiresAt?: Date;
}

export interface BackupSet {
  readonly id: BackupSetId;
  readonly policyId: BackupPolicyId;
  readonly jobs: BackupJobId[];
  readonly status: BackupStatus;
  readonly fullBackupJobId?: BackupJobId;   // reference to base full backup
  readonly createdAt: Date;
}

// ─── Service Interface ───────────────────────────────────────────────────────

export interface IBackupGovernanceService {
  createPolicy(input: CreateBackupPolicyInput): Promise<GovernanceResult<BackupPolicy>>;
  updatePolicy(id: BackupPolicyId, input: Partial<CreateBackupPolicyInput>, by: string): Promise<GovernanceResult<BackupPolicy>>;
  deletePolicy(id: BackupPolicyId, by: string): Promise<GovernanceResult<void>>;
  getPolicy(id: BackupPolicyId): Promise<BackupPolicy | null>;
  listPolicies(organizationId?: string): Promise<BackupPolicy[]>;
  triggerBackup(policyId: BackupPolicyId, by: string): Promise<GovernanceResult<BackupJob>>;
  getJob(id: BackupJobId): Promise<BackupJob | null>;
  listJobs(policyId: BackupPolicyId, limit?: number): Promise<BackupJob[]>;
  verifyBackup(jobId: BackupJobId): Promise<GovernanceResult<BackupVerificationResult>>;
  getComplianceStatus(orgId: string): Promise<BackupComplianceStatus>;
}

export interface CreateBackupPolicyInput {
  readonly name: string;
  readonly description?: string;
  readonly organizationId?: string;
  readonly targets: BackupTarget[];
  readonly schedule: BackupSchedule;
  readonly retention: BackupRetention;
  readonly encryption?: BackupEncryption;
  readonly destinationId: string;
  readonly verifyAfterBackup?: boolean;
  readonly notificationChannels?: string[];
  readonly createdBy: string;
}

export interface BackupVerificationResult {
  readonly jobId: BackupJobId;
  readonly valid: boolean;
  readonly checksumsPassed: number;
  readonly checksumsFailed: number;
  readonly sizeVerified: boolean;
  readonly restoreTestPassed?: boolean;
  readonly verifiedAt: Date;
}

export interface BackupComplianceStatus {
  readonly organizationId: string;
  readonly policiesActive: number;
  readonly lastSuccessfulBackup?: Date;
  readonly oldestBackupAge: number;         // hours
  readonly coveragePercent: number;         // % of targets covered
  readonly issues: string[];
  readonly compliant: boolean;
  readonly generatedAt: Date;
}
