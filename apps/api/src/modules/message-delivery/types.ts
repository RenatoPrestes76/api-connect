// ─── Status ─────────────────────────────────────────────────────────────────
// CREATED -> QUEUED -> SENT -> DELIVERED -> ACKNOWLEDGED -> EXECUTING ->
// COMPLETED | FAILED, with QUEUED/SENT able to fall back to DEAD_LETTER once
// redelivery attempts are exhausted. SENT/DELIVERED/ACKNOWLEDGED are recorded
// as distinct steps in `history` even though — with no real network-ack layer
// in this codebase — the server advances through them in a single request
// (see message-delivery-store.ts's `acknowledge()`), so the full journey stays
// traceable without inventing a transport-level ack this repo has no way to
// observe.

export type MessageStatus =
  | 'CREATED'
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'ACKNOWLEDGED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'DEAD_LETTER';

export const TERMINAL_MESSAGE_STATUSES: readonly MessageStatus[] = [
  'COMPLETED',
  'FAILED',
  'DEAD_LETTER',
];

/** Statuses considered "in flight" for ordering purposes — only one per resourceKey may be in flight at a time. */
export const IN_FLIGHT_MESSAGE_STATUSES: readonly MessageStatus[] = [
  'SENT',
  'DELIVERED',
  'ACKNOWLEDGED',
  'EXECUTING',
];

export type MessageType = 'JOB_DISPATCH' | 'JOB_CANCEL' | 'PING' | 'CUSTOM';

export interface MessageHistoryEvent {
  status: MessageStatus;
  at: string;
  detail: string | null;
}

// ─── Message ────────────────────────────────────────────────────────────────

export interface MessageRecord {
  id: string;
  jobId: string | null;
  organizationId: string;
  runtimeId: string;
  /** Ordering key — commands sharing a resourceKey execute strictly in sequenceNumber order; different keys run in parallel. */
  resourceKey: string;
  sequenceNumber: number;
  messageType: MessageType;
  payload: Record<string, unknown>;
  checksum: string;
  /** HMAC signature over the canonical outbound payload — lets the Runtime verify this message truly came from Atlas. */
  signature: string;
  status: MessageStatus;
  deliveryAttempts: number;
  maxDeliveryAttempts: number;
  ackTimeoutMs: number;
  correlationId: string;
  traceId: string;
  history: MessageHistoryEvent[];
  lastError: string | null;
  /** Signature of the most recently accepted ACK — rejects verbatim request replay. Not exposed via any DTO. */
  lastAckSignature: string | null;
  createdAt: string;
  /** When this message (or its next redelivery attempt) becomes eligible to be sent. */
  scheduledAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  acknowledgedAt: string | null;
  finishedAt: string | null;
  expiresAt: string;
}

export interface MessageDTO {
  id: string;
  jobId: string | null;
  organizationId: string;
  runtimeId: string;
  resourceKey: string;
  sequenceNumber: number;
  messageType: MessageType;
  payload: Record<string, unknown>;
  checksum: string;
  status: MessageStatus;
  deliveryAttempts: number;
  maxDeliveryAttempts: number;
  correlationId: string;
  traceId: string;
  history: MessageHistoryEvent[];
  lastError: string | null;
  createdAt: string;
  scheduledAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  acknowledgedAt: string | null;
  finishedAt: string | null;
  expiresAt: string;
}

// ─── Dead letter ────────────────────────────────────────────────────────────

export interface DeadLetterRecord {
  id: string;
  messageId: string;
  organizationId: string;
  runtimeId: string;
  reason: string;
  attempts: number;
  lastError: string;
  createdAt: string;
}

// ─── Create input / errors ─────────────────────────────────────────────────

export interface SendMessageInput {
  organizationId: string;
  runtimeId: string;
  jobId?: string;
  resourceKey?: string;
  messageType: MessageType;
  payload?: Record<string, unknown>;
  correlationId?: string;
  traceId?: string;
  maxDeliveryAttempts?: number;
  ackTimeoutMs?: number;
  ttlMs?: number;
}

export type SendMessageError = 'RUNTIME_NOT_FOUND' | 'RUNTIME_ORGANIZATION_MISMATCH';

export type AcknowledgeError =
  | 'MESSAGE_NOT_FOUND'
  | 'RUNTIME_MISMATCH'
  | 'INVALID_SIGNATURE'
  | 'REPLAY_REJECTED';

export type ReprocessError = 'DEAD_LETTER_ENTRY_NOT_FOUND';
