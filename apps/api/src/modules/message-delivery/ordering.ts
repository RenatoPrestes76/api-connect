import type { MessageRecord } from './types.js';
import { IN_FLIGHT_MESSAGE_STATUSES } from './types.js';

/**
 * The ordering key defaults to organizationId (spec: "por exemplo:
 * organização; filial; conector; produto") — callers that need finer-grained
 * sequencing (per branch/connector/product) pass an explicit resourceKey.
 * Messages with different resourceKeys are never blocked by one another
 * ("comandos independentes continuam podendo ser processados em paralelo").
 */
export function resolveResourceKey(
  organizationId: string,
  resourceKey: string | undefined
): string {
  return resourceKey ?? organizationId;
}

/**
 * A QUEUED message is eligible to be sent only once every earlier
 * (lower-sequenceNumber) message sharing its resourceKey has left the
 * in-flight window, and no other message for that resourceKey is currently
 * in flight. `sameKeyMessages` must contain every message sharing the
 * candidate's resourceKey (any status).
 */
export function isEligibleToSend(
  candidate: MessageRecord,
  sameKeyMessages: readonly MessageRecord[]
): boolean {
  const hasInFlightSibling = sameKeyMessages.some(
    (m) => m.id !== candidate.id && IN_FLIGHT_MESSAGE_STATUSES.includes(m.status)
  );
  if (hasInFlightSibling) return false;

  const hasEarlierPending = sameKeyMessages.some(
    (m) =>
      m.id !== candidate.id && m.status === 'QUEUED' && m.sequenceNumber < candidate.sequenceNumber
  );
  return !hasEarlierPending;
}
