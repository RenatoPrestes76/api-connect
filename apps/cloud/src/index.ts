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

export const CLOUD_VERSION  = '0.1.0';
export const CLOUD_CODENAME = 'Atlas';
