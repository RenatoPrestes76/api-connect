import { isVersionAtLeast } from '../runtime-registration/version-control.js';
import { isSupportedDbType } from '../erp-connectivity/drivers.js';
import { validateExecutionPolicy } from './execution-policy.js';
import type { RuntimeRegistrationRecord } from '../runtime-registration/types.js';
import type { ConnectorRecord } from '../connectors/types.js';
import type { ConnectionProfileRecord } from '../erp-connectivity/types.js';
import type {
  ConnectorAction,
  ExecutionValidationChecks,
  ExecutionValidationResult,
} from './types.js';

const INVALID_PROFILE_STATUSES = new Set(['DISABLED', 'DOWN', 'CIRCUIT_OPEN']);

/**
 * Per-action payload shape checks. Only known actions with a real payload
 * contract are validated here; anything else (including unrecognized
 * actions) passes through untouched — new actions never require touching
 * this function, matching ConnectorAction's own open-string design.
 */
export function validateActionPayload(
  action: ConnectorAction,
  payload: Record<string, unknown>
): boolean {
  if (action === 'PRICE_MARKDOWN') {
    const { productId, newPrice, previousPrice } = payload as {
      productId?: unknown;
      newPrice?: unknown;
      previousPrice?: unknown;
    };
    return (
      typeof productId === 'string' &&
      productId.length > 0 &&
      typeof newPrice === 'number' &&
      Number.isFinite(newPrice) &&
      newPrice > 0 &&
      typeof previousPrice === 'number' &&
      Number.isFinite(previousPrice) &&
      previousPrice > 0
    );
  }
  return true;
}

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
  action: ConnectorAction;
  payload: Record<string, unknown>;
}): ExecutionValidationResult {
  const { runtime, connector, profile, action, payload } = input;

  const runtimeAuthorized = runtime.status !== 'BLOCKED' && runtime.status !== 'REVOKED';
  const connectorActive = connector.status === 'active';
  const profileValid = !INVALID_PROFILE_STATUSES.has(profile.status);
  const driverCompatible = isSupportedDbType(profile.dbType);
  const minVersionOk = isVersionAtLeast(runtime.version, connector.minRuntimeVersion);
  const payloadValid = validateActionPayload(action, payload);
  const policyCompliant = validateExecutionPolicy(action, payload);

  const checks: ExecutionValidationChecks = {
    runtimeAuthorized,
    connectorActive,
    profileValid,
    driverCompatible,
    minVersionOk,
    payloadValid,
    policyCompliant,
  };

  const ok = Object.values(checks).every(Boolean);
  const failureReason = ok
    ? null
    : (Object.entries(checks).find(([, passed]) => !passed)?.[0] ?? 'unknown');

  return { ok, checks, failureReason };
}
