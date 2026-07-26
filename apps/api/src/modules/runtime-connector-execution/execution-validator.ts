import { isVersionAtLeast } from '../runtime-registration/version-control.js';
import { isSupportedDbType } from '../erp-connectivity/drivers.js';
import type { RuntimeRegistrationRecord } from '../runtime-registration/types.js';
import type { ConnectorRecord } from '../connectors/types.js';
import type { ConnectionProfileRecord } from '../erp-connectivity/types.js';
import type { ExecutionValidationChecks, ExecutionValidationResult } from './types.js';

const INVALID_PROFILE_STATUSES = new Set(['DISABLED', 'DOWN', 'CIRCUIT_OPEN']);

/**
 * Pre-flight checks required before an Execution Plan is dispatched to a
 * Runtime — everything here reuses records already owned by other modules
 * (runtime-registration, connectors, erp-connectivity); this engine adds no
 * new persisted state of its own.
 */
export function validateExecution(input: {
  runtime: RuntimeRegistrationRecord;
  connector: ConnectorRecord;
  profile: ConnectionProfileRecord;
}): ExecutionValidationResult {
  const { runtime, connector, profile } = input;

  const runtimeAuthorized = runtime.status !== 'BLOCKED' && runtime.status !== 'REVOKED';
  const connectorActive = connector.status === 'active';
  const profileValid = !INVALID_PROFILE_STATUSES.has(profile.status);
  const driverCompatible = isSupportedDbType(profile.dbType);
  const minVersionOk = isVersionAtLeast(runtime.version, connector.minRuntimeVersion);

  const checks: ExecutionValidationChecks = {
    runtimeAuthorized,
    connectorActive,
    profileValid,
    driverCompatible,
    minVersionOk,
  };

  const ok = Object.values(checks).every(Boolean);
  const failureReason = ok
    ? null
    : (Object.entries(checks).find(([, passed]) => !passed)?.[0] ?? 'unknown');

  return { ok, checks, failureReason };
}
