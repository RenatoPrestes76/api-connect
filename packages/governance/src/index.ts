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

export * from './policies/index.js';
export { PolicyEngineImpl, GovernancePolicyError, createPolicyEngine } from './policies/engine.js';
export * from './rbac/index.js';
export * from './permissions/index.js';
export * from './organizations/index.js';
export * from './workspaces/index.js';
export * from './environments/index.js';
export * from './clusters/index.js';
export * from './nodes/index.js';
export * from './approval/index.js';
export * from './change-management/index.js';
export * from './audit/index.js';
export * from './compliance/index.js';
export * from './configuration/index.js';
export * from './feature-management/index.js';
export * from './package-registry/index.js';
export * from './release-management/index.js';
export * from './backup/index.js';
export * from './recovery/index.js';
export * from './version-catalog/index.js';
export * from './secret-management/index.js';
export * from './tenant-isolation/index.js';

// ─── Governance Version ──────────────────────────────────────────────────────

export const GOVERNANCE_VERSION = '0.1.0' as const;
export const GOVERNANCE_CODENAME = 'Atlas Governance' as const;
