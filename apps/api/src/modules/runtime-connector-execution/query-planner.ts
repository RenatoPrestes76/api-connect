import { DRIVER_REGISTRY } from '../erp-connectivity/drivers.js';
import type { DbType } from '../erp-connectivity/types.js';
import type { ConnectorAction } from './types.js';

export interface QueryPlanInput {
  action: ConnectorAction;
  payload: Record<string, unknown>;
  dbType: DbType;
}

export interface QueryPlan {
  action: ConnectorAction;
  payload: Record<string, unknown>;
  dbType: DbType;
  driverVersion: string;
}

/**
 * Converts a Job's command ("Connector Action") into an Execution Plan by
 * resolving which driver will run it — no live driver code here (apps/api
 * has no DB driver dependencies by design; only the Atlas Runtime executes
 * against the ERP). This is deliberately a pure, side-effect-free function
 * so ExecutionValidatorEngine and the store can each call it independently.
 */
export function buildExecutionPlan(input: QueryPlanInput): QueryPlan {
  const driver = DRIVER_REGISTRY[input.dbType];
  return {
    action: input.action,
    payload: input.payload,
    dbType: input.dbType,
    driverVersion: driver.simulatedVersion,
  };
}
