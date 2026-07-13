/**
 * @seltriva/governance — recovery
 *
 * Disaster Recovery architecture: recovery plans, RPO/RTO objectives,
 * recovery points, failover procedures, and DR test governance.
 *
 * This is architecture only — no DR engine implementation.
 * Concrete recovery procedures are defined and executed by operators.
 */

import type { GovernanceResult } from '../policies/index';
import type { BackupJobId } from '../backup/index';

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };
export type RecoveryPlanId = Branded<string, 'RecoveryPlanId'>;
export type RecoveryPointId = Branded<string, 'RecoveryPointId'>;
export type DRTestId = Branded<string, 'DRTestId'>;

// ─── Recovery Objectives ─────────────────────────────────────────────────────

export interface RecoveryObjectives {
  readonly rpoHours: number; // Recovery Point Objective: max data loss
  readonly rtoHours: number; // Recovery Time Objective: max downtime
  readonly mtpdHours?: number; // Maximum Tolerable Period of Disruption
  readonly tier: DRTier;
}

export type DRTier =
  | 'tier-1' // 0–1h RTO, continuous protection (mission-critical)
  | 'tier-2' // 1–4h RTO, near-realtime replication
  | 'tier-3' // 4–8h RTO, daily backup
  | 'tier-4'; // 8–24h RTO, weekly backup

// ─── Recovery Plan ───────────────────────────────────────────────────────────

export type RecoveryScenario =
  | 'data-corruption'
  | 'regional-outage'
  | 'complete-system-loss'
  | 'security-breach'
  | 'infrastructure-failure'
  | 'human-error'
  | 'ransomware';

export type RecoveryPlanStatus = 'draft' | 'approved' | 'active' | 'superseded' | 'archived';

export interface RecoveryPlan {
  readonly id: RecoveryPlanId;
  readonly name: string;
  readonly version: string;
  readonly organizationId?: string;
  readonly scenario: RecoveryScenario;
  readonly status: RecoveryPlanStatus;
  readonly objectives: RecoveryObjectives;
  readonly scope: RecoveryScope;
  readonly phases: RecoveryPhase[];
  readonly prerequisites: string[];
  readonly contacts: RecoveryContact[];
  readonly communicationPlan: string;
  readonly testSchedule?: DRTestSchedule;
  readonly lastTestedAt?: Date;
  readonly lastTestResult?: 'passed' | 'failed' | 'partial';
  readonly approvedBy?: string;
  readonly approvedAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface RecoveryScope {
  readonly components: string[]; // system components covered
  readonly environments: string[]; // environments covered
  readonly dataTypes: string[];
  readonly excludes?: string[];
}

export interface RecoveryPhase {
  readonly order: number;
  readonly name: string;
  readonly type: PhaseType;
  readonly steps: RecoveryStep[];
  readonly estimatedMinutes: number;
  readonly required: boolean;
  readonly automatable: boolean;
  readonly verificationSteps: string[];
}

export type PhaseType =
  | 'initiation'
  | 'assessment'
  | 'restore'
  | 'validation'
  | 'notification'
  | 'escalation'
  | 'closeout';

export interface RecoveryStep {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly responsible: string; // role or person
  readonly automated: boolean;
  readonly command?: string;
  readonly expectedDurationMinutes?: number;
  readonly successCriteria?: string;
  readonly rollbackInstruction?: string;
}

export interface RecoveryContact {
  readonly role: string;
  readonly name: string;
  readonly email: string;
  readonly phone?: string;
  readonly primary: boolean;
}

export interface DRTestSchedule {
  readonly frequencyMonths: number;
  readonly nextTestDue: Date;
  readonly testType: 'tabletop' | 'functional' | 'full';
}

// ─── Recovery Point ──────────────────────────────────────────────────────────

export interface RecoveryPoint {
  readonly id: RecoveryPointId;
  readonly organizationId?: string;
  readonly backupJobId?: BackupJobId;
  readonly name: string;
  readonly description?: string;
  readonly type: RecoveryPointType;
  readonly components: string[];
  readonly dataTimestamp: Date; // when data was captured
  readonly rpoSatisfied: boolean;
  readonly sizeBytes: number;
  readonly location: string;
  readonly validated: boolean;
  readonly validatedAt?: Date;
  readonly expiresAt?: Date;
  readonly createdAt: Date;
}

export type RecoveryPointType = 'backup' | 'snapshot' | 'replica' | 'export';

// ─── DR Test ─────────────────────────────────────────────────────────────────

export interface DRTest {
  readonly id: DRTestId;
  readonly planId: RecoveryPlanId;
  readonly type: 'tabletop' | 'functional' | 'full';
  readonly scenario: RecoveryScenario;
  readonly status: 'planned' | 'in-progress' | 'completed' | 'cancelled';
  readonly recoveryPointId?: RecoveryPointId;
  readonly actualRTOMinutes?: number;
  readonly actualRPOMinutes?: number;
  readonly rtoMet?: boolean;
  readonly rpoMet?: boolean;
  readonly issues: DRTestIssue[];
  readonly observations: string;
  readonly lessonsLearned?: string;
  readonly participants: string[];
  readonly scheduledAt: Date;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly conductedBy: string;
}

export interface DRTestIssue {
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly description: string;
  readonly remediation?: string;
  readonly owner?: string;
  readonly resolvedAt?: Date;
}

// ─── Service Interface ───────────────────────────────────────────────────────

export interface IDRGovernanceService {
  createPlan(input: CreateRecoveryPlanInput): Promise<GovernanceResult<RecoveryPlan>>;
  approvePlan(id: RecoveryPlanId, by: string): Promise<GovernanceResult<RecoveryPlan>>;
  getActivePlan(orgId: string, scenario: RecoveryScenario): Promise<RecoveryPlan | null>;
  listPlans(orgId?: string): Promise<RecoveryPlan[]>;
  createRecoveryPoint(input: CreateRecoveryPointInput): Promise<GovernanceResult<RecoveryPoint>>;
  listRecoveryPoints(orgId?: string, since?: Date): Promise<RecoveryPoint[]>;
  scheduleDRTest(
    planId: RecoveryPlanId,
    input: ScheduleDRTestInput
  ): Promise<GovernanceResult<DRTest>>;
  recordDRTestResult(
    testId: DRTestId,
    result: DRTestResultInput
  ): Promise<GovernanceResult<DRTest>>;
  getDRStatus(orgId: string): Promise<DRStatusReport>;
}

export interface CreateRecoveryPlanInput {
  readonly name: string;
  readonly version?: string;
  readonly organizationId?: string;
  readonly scenario: RecoveryScenario;
  readonly objectives: RecoveryObjectives;
  readonly scope: RecoveryScope;
  readonly phases: Omit<RecoveryPhase, 'order'>[];
  readonly prerequisites?: string[];
  readonly contacts: RecoveryContact[];
  readonly communicationPlan: string;
  readonly createdBy: string;
}

export interface CreateRecoveryPointInput {
  readonly organizationId?: string;
  readonly name: string;
  readonly type: RecoveryPointType;
  readonly components: string[];
  readonly dataTimestamp: Date;
  readonly sizeBytes: number;
  readonly location: string;
  readonly backupJobId?: BackupJobId;
  readonly expiresAt?: Date;
}

export interface ScheduleDRTestInput {
  readonly type: 'tabletop' | 'functional' | 'full';
  readonly scenario: RecoveryScenario;
  readonly scheduledAt: Date;
  readonly participants: string[];
  readonly conductedBy: string;
}

export interface DRTestResultInput {
  readonly actualRTOMinutes: number;
  readonly actualRPOMinutes: number;
  readonly issues: DRTestIssue[];
  readonly observations: string;
  readonly lessonsLearned?: string;
  readonly recoveryPointId?: RecoveryPointId;
}

export interface DRStatusReport {
  readonly organizationId: string;
  readonly activePlans: number;
  readonly plansNeedingTest: number;
  readonly lastTestDate?: Date;
  readonly lastTestResult?: 'passed' | 'failed' | 'partial';
  readonly rtoMet?: boolean;
  readonly rpoMet?: boolean;
  readonly recoveryPoints: number;
  readonly oldestRecoveryPointAge?: number; // hours
  readonly compliant: boolean;
  readonly generatedAt: Date;
}
