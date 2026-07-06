/**
 * @seltriva/governance
 * Enterprise Governance Architecture — root barrel.
 *
 * Exports all 21 governance modules.
 * Import from sub-paths for tree-shaking:
 *   import type { IComplianceService } from '@seltriva/governance/compliance'
 *
 * Or import everything:
 *   import * as Governance from '@seltriva/governance'
 */

export * from './policies/index';
export { PolicyEngineImpl, GovernancePolicyError, createPolicyEngine } from './policies/engine.js';
export * from './rbac/index';
export * from './permissions/index';
export * from './organizations/index';
export * from './workspaces/index';
export * from './environments/index';
export * from './clusters/index';
export * from './nodes/index';
export * from './approval/index';
export * from './change-management/index';
export * from './audit/index';
export * from './compliance/index';
export * from './configuration/index';
export * from './feature-management/index';
export * from './package-registry/index';
export * from './release-management/index';
export * from './backup/index';
export * from './recovery/index';
export * from './version-catalog/index';
export * from './secret-management/index';
export * from './tenant-isolation/index';

// ─── Governance Version ──────────────────────────────────────────────────────

export const GOVERNANCE_VERSION = '0.1.0' as const;
export const GOVERNANCE_CODENAME = 'Atlas Governance' as const;
