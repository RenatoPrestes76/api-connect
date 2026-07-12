/**
 * @seltriva/cloud — root barrel
 * Atlas Cloud Control Plane — all public types and contracts.
 *
 * @version 0.1.0
 * @codename Atlas
 */

export * from './domain/index';
export * from './application/index';
export * from './infrastructure/index';
export * from './api/index';
export * from './runtime/index';
export * from './services/index';

// Modules
export * from './agents/index';
export * from './audit/index';
export * from './configuration/index';
export * from './health/index';
export * from './jobs/index';
export * from './licenses/index';
export * from './metrics/index';
export * from './monitoring/index';
export * from './notifications/index';
export * from './organizations/index';
export * from './plugins/index';
export * from './scheduler/index';
export * from './security/index';
export * from './storage/index';
export * from './telemetry/index';
export * from './users/index';

// Test infrastructure (dev/test only — not imported in production bundles)
export type * from './tests/index';

// The wildcard exports above collide on 3 names: the layer barrels (application/api/
// infrastructure) each declare a lightweight DTO, while the corresponding domain module
// (organizations/plugins/storage) declares a richer, branded-type view under the same
// name. Both are intentional and kept — an explicit bare-name re-export is required to
// resolve the ambiguity (TS2308); the domain module version wins under the bare name,
// and the DTO version is exposed under an explicit alias.
export type { OrganizationMemberView } from './organizations/index';
export type { OrganizationMemberView as ApplicationOrganizationMemberView } from './application/index';
export type { PluginListItem } from './plugins/index';
export type { PluginListItem as ApiPluginListItem } from './api/index';
export type { StoredFile } from './storage/index';
export type { StoredFile as InfrastructureStoredFile } from './infrastructure/index';

export const CLOUD_VERSION = '0.1.0';
export const CLOUD_CODENAME = 'Atlas';
