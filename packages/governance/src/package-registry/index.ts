/**
 * @seltriva/governance — package-registry
 *
 * Plugin package registry governance: submission, review, approval pipeline,
 * and distribution control.
 *
 * This is the governance layer above the marketplace-api publish contracts.
 * It enforces policy before a plugin appears in the marketplace.
 */

import type { GovernanceResult } from '../policies/index';

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };
export type RegistryPackageId = Branded<string, 'RegistryPackageId'>;
export type PackageSubmissionId = Branded<string, 'PackageSubmissionId'>;
export type PackageReviewId = Branded<string, 'PackageReviewId'>;

// ─── Package Types ───────────────────────────────────────────────────────────

export type RegistryPackageType = 'plugin' | 'connector' | 'erp-profile' | 'template' | 'extension';
export type PackageStatus =
  | 'draft'
  | 'pending'
  | 'in-review'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'suspended'
  | 'deprecated';
export type ReviewerRole = 'technical' | 'security' | 'compliance' | 'editorial';

// ─── Registry Package ────────────────────────────────────────────────────────

export interface RegistryPackage {
  readonly id: RegistryPackageId;
  readonly name: string; // reverse-domain: "com.acme.my-connector"
  readonly displayName: string;
  readonly type: RegistryPackageType;
  readonly publisherId: string;
  readonly organizationId?: string;
  readonly visibility: 'public' | 'private' | 'unlisted';
  readonly status: PackageStatus;
  readonly currentVersion?: string;
  readonly latestSubmissionId?: PackageSubmissionId;
  readonly totalInstalls: number;
  readonly verified: boolean; // official verified publisher
  readonly tags: string[];
  readonly licenseType: string; // SPDX
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// ─── Package Submission ──────────────────────────────────────────────────────

export interface PackageSubmission {
  readonly id: PackageSubmissionId;
  readonly packageId: RegistryPackageId;
  readonly version: string; // semver
  readonly releaseChannel: 'stable' | 'beta' | 'edge';
  readonly changelog: string;
  readonly manifestSnapshot: Record<string, unknown>; // manifest at submission time
  readonly packageHash: string; // SHA-256 of .atlasp file
  readonly packageSizeBytes: number;
  readonly packageUrl: string; // signed upload URL
  readonly validationScore?: number; // 0–100 from packages/validator
  readonly validationReportUrl?: string;
  readonly status: PackageStatus;
  readonly reviews: PackageReview[];
  readonly rejectionReasons?: string[];
  readonly approvedAt?: Date;
  readonly publishedAt?: Date;
  readonly submittedBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PackageReview {
  readonly id: PackageReviewId;
  readonly submissionId: PackageSubmissionId;
  readonly reviewerRole: ReviewerRole;
  readonly reviewerId: string;
  readonly status: 'pending' | 'in-progress' | 'approved' | 'rejected' | 'abstained';
  readonly checklist: ReviewChecklistItem[];
  readonly verdict: 'approve' | 'reject' | 'request-changes' | null;
  readonly notes?: string;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
}

export interface ReviewChecklistItem {
  readonly id: string;
  readonly category: ReviewerRole;
  readonly question: string;
  readonly required: boolean;
  readonly answer?: 'pass' | 'fail' | 'na';
  readonly notes?: string;
}

// ─── Registry Policy ─────────────────────────────────────────────────────────

export interface RegistryPolicy {
  readonly requireAllReviewerRoles: ReviewerRole[];
  readonly minimumValidationScore: number;
  readonly autoApproveVerifiedPublishers: boolean;
  readonly allowBetaChannel: boolean;
  readonly allowEdgeChannel: boolean;
  readonly maxPackageSizeMb: number;
  readonly forbiddenDependencies: string[];
  readonly requiredLicenses: string[]; // only SPDX IDs allowed
  readonly quarantinePeriodDays: number; // after approval before publish
}

export const DEFAULT_REGISTRY_POLICY: RegistryPolicy = {
  requireAllReviewerRoles: ['technical', 'security'],
  minimumValidationScore: 80,
  autoApproveVerifiedPublishers: false,
  allowBetaChannel: true,
  allowEdgeChannel: false,
  maxPackageSizeMb: 50,
  forbiddenDependencies: [],
  requiredLicenses: [],
  quarantinePeriodDays: 2,
};

// ─── Service Interface ───────────────────────────────────────────────────────

export interface IPackageRegistryService {
  submitPackage(input: SubmitPackageInput): Promise<GovernanceResult<PackageSubmission>>;
  assignReviewer(
    submissionId: PackageSubmissionId,
    reviewerId: string,
    role: ReviewerRole
  ): Promise<GovernanceResult<void>>;
  submitReview(input: SubmitReviewInput): Promise<GovernanceResult<PackageReview>>;
  publishSubmission(submissionId: PackageSubmissionId, by: string): Promise<GovernanceResult<void>>;
  rejectSubmission(
    submissionId: PackageSubmissionId,
    reasons: string[],
    by: string
  ): Promise<GovernanceResult<void>>;
  suspendPackage(
    packageId: RegistryPackageId,
    reason: string,
    by: string
  ): Promise<GovernanceResult<void>>;
  deprecatePackage(
    packageId: RegistryPackageId,
    successor?: string,
    by?: string
  ): Promise<GovernanceResult<void>>;
  getPackage(id: RegistryPackageId): Promise<RegistryPackage | null>;
  getSubmission(id: PackageSubmissionId): Promise<PackageSubmission | null>;
  listPackages(filter: PackageListFilter): Promise<RegistryPackage[]>;
  listPendingSubmissions(): Promise<PackageSubmission[]>;
  getRegistryPolicy(): Promise<RegistryPolicy>;
  setRegistryPolicy(policy: Partial<RegistryPolicy>, by: string): Promise<GovernanceResult<void>>;
}

export interface SubmitPackageInput {
  readonly packageId?: RegistryPackageId; // new package if omitted
  readonly name?: string;
  readonly displayName?: string;
  readonly type?: RegistryPackageType;
  readonly version: string;
  readonly releaseChannel?: 'stable' | 'beta' | 'edge';
  readonly changelog: string;
  readonly packageHash: string;
  readonly packageSizeBytes: number;
  readonly packageUrl: string;
  readonly licenseType?: string;
  readonly tags?: string[];
  readonly submittedBy: string;
}

export interface SubmitReviewInput {
  readonly reviewId: PackageReviewId;
  readonly checklist: ReviewChecklistItem[];
  readonly verdict: 'approve' | 'reject' | 'request-changes';
  readonly notes?: string;
  readonly reviewerId: string;
}

export interface PackageListFilter {
  readonly type?: RegistryPackageType;
  readonly status?: PackageStatus;
  readonly publisherId?: string;
  readonly organizationId?: string;
  readonly visibility?: 'public' | 'private' | 'unlisted';
  readonly verified?: boolean;
  readonly search?: string;
}
