import type { ConnectorAction } from './types.js';

/**
 * ERP Execution Policy — an explicit allow-list of payload fields each
 * known action may touch. A payload carrying any field outside its
 * action's allow-list is rejected outright (policyCompliant: false), never
 * silently dropped — this is what actually enforces "PRICE_MARKDOWN pode
 * alterar preço de venda, mas nunca custo/estoque/exclusão": those fields
 * are simply never in the allow-list, so any attempt to sneak them into a
 * markdown payload fails validation instead of being ignored.
 *
 * Actions with no entry here are unrestricted (same extensibility
 * principle as ConnectorAction/validateActionPayload) — a new action never
 * requires touching this file unless it specifically needs a policy.
 */
const ERP_EXECUTION_POLICIES: Partial<Record<KnownActionWithPolicy, readonly string[]>> = {
  PRICE_MARKDOWN: ['productId', 'newPrice', 'previousPrice'],
};

type KnownActionWithPolicy = 'PRICE_MARKDOWN';

export function validateExecutionPolicy(
  action: ConnectorAction,
  payload: Record<string, unknown>
): boolean {
  const allowedFields = ERP_EXECUTION_POLICIES[action as KnownActionWithPolicy];
  if (!allowedFields) return true;
  return Object.keys(payload).every((key) => allowedFields.includes(key));
}
