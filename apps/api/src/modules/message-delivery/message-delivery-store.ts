import { randomUUID } from 'node:crypto';
import { runtimeRegistrationStore } from '../runtime-registration/runtime-registration-store.js';
import { jobOrchestrationStore } from '../job-orchestration/job-orchestration-store.js';
import { computeMessageChecksum, signMessagePayload } from './message-signature.js';
import { resolveResourceKey, isEligibleToSend } from './ordering.js';
import {
  computeRedeliveryDelayMs,
  DEFAULT_MAX_DELIVERY_ATTEMPTS,
  DEFAULT_ACK_TIMEOUT_MS,
  DEFAULT_TTL_MS,
} from './retry-policy.js';
import type {
  MessageRecord,
  MessageDTO,
  MessageStatus,
  DeadLetterRecord,
  SendMessageInput,
  SendMessageError,
  AcknowledgeError,
  ReprocessError,
} from './types.js';
import { TERMINAL_MESSAGE_STATUSES } from './types.js';

export type SendMessageResult =
  | { ok: true; message: MessageRecord }
  | { ok: false; error: SendMessageError };
export type AcknowledgeResult =
  | { ok: true; message: MessageRecord; alreadyAcknowledged: boolean }
  | { ok: false; error: AcknowledgeError };
export type ReprocessResult =
  | { ok: true; message: MessageRecord }
  | { ok: false; error: ReprocessError };

let _instance: MessageDeliveryStore | null = null;

export class MessageDeliveryStore {
  private messages: MessageRecord[] = [];
  private deadLetters: DeadLetterRecord[] = [];
  private sequenceCounters = new Map<string, number>();

  static getInstance(): MessageDeliveryStore {
    if (!_instance) _instance = new MessageDeliveryStore();
    return _instance;
  }

  private nextSequenceNumber(resourceKey: string): number {
    const next = (this.sequenceCounters.get(resourceKey) ?? 0) + 1;
    this.sequenceCounters.set(resourceKey, next);
    return next;
  }

  private appendHistory(
    message: MessageRecord,
    status: MessageStatus,
    detail: string | null
  ): void {
    message.history.push({ status, at: new Date().toISOString(), detail });
  }

  // ─── Lazy lifecycle evaluation (no background scheduler in this codebase) ─

  private evaluateLifecycle(message: MessageRecord): MessageRecord {
    if (TERMINAL_MESSAGE_STATUSES.includes(message.status)) return message;
    const now = Date.now();

    if (message.status === 'CREATED' || message.status === 'QUEUED') {
      if (now > new Date(message.expiresAt).getTime()) {
        this.moveToDeadLetter(message, 'expired', 'Message expired before it could be delivered');
      }
      return message;
    }

    if (message.status === 'SENT') {
      const elapsed = now - new Date(message.sentAt ?? message.createdAt).getTime();
      if (elapsed > message.ackTimeoutMs) {
        this.recordDeliveryFailure(message, 'Acknowledgement not received within timeout window');
      }
      return message;
    }

    if (message.status === 'EXECUTING' && message.jobId) {
      const job = jobOrchestrationStore.getJob(message.jobId);
      if (job) {
        if (job.status === 'SUCCESS') {
          message.status = 'COMPLETED';
          message.finishedAt = new Date().toISOString();
          this.appendHistory(message, 'COMPLETED', 'Linked job reported success');
        } else if (
          job.status === 'FAILED' ||
          job.status === 'CANCELLED' ||
          job.status === 'EXPIRED'
        ) {
          message.status = 'FAILED';
          message.finishedAt = new Date().toISOString();
          message.lastError = job.lastError ?? `Linked job ended as ${job.status}`;
          this.appendHistory(message, 'FAILED', message.lastError);
        }
      }
      return message;
    }

    return message;
  }

  private recordDeliveryFailure(message: MessageRecord, error: string): void {
    message.deliveryAttempts += 1;
    message.lastError = error;

    if (message.deliveryAttempts < message.maxDeliveryAttempts) {
      message.status = 'QUEUED';
      message.sentAt = null;
      const delayMs = computeRedeliveryDelayMs(message.deliveryAttempts);
      message.scheduledAt = new Date(Date.now() + delayMs).toISOString();
      this.appendHistory(
        message,
        'QUEUED',
        `${error} — requeued for redelivery (attempt ${message.deliveryAttempts})`
      );
    } else {
      this.moveToDeadLetter(message, 'ack_timeout_exhausted', error);
    }
  }

  private moveToDeadLetter(message: MessageRecord, reason: string, error: string): void {
    message.status = 'DEAD_LETTER';
    message.finishedAt = new Date().toISOString();
    message.lastError = error;
    this.appendHistory(message, 'DEAD_LETTER', `${reason}: ${error}`);
    this.deadLetters.push({
      id: randomUUID(),
      messageId: message.id,
      organizationId: message.organizationId,
      runtimeId: message.runtimeId,
      reason,
      attempts: message.deliveryAttempts,
      lastError: error,
      createdAt: message.finishedAt,
    });
  }

  // ─── Reads ───────────────────────────────────────────────────────────────

  getMessage(id: string): MessageRecord | undefined {
    const message = this.messages.find((m) => m.id === id);
    return message ? this.evaluateLifecycle(message) : undefined;
  }

  listMessages(
    filters: { organizationId?: string; runtimeId?: string; status?: MessageStatus } = {}
  ): MessageRecord[] {
    return this.messages
      .map((m) => this.evaluateLifecycle(m))
      .filter((m) => {
        if (filters.organizationId && m.organizationId !== filters.organizationId) return false;
        if (filters.runtimeId && m.runtimeId !== filters.runtimeId) return false;
        if (filters.status && m.status !== filters.status) return false;
        return true;
      });
  }

  listDeadLetters(
    filters: { organizationId?: string; runtimeId?: string } = {}
  ): DeadLetterRecord[] {
    // Sweep first: a message can be sitting past its ack-timeout without
    // anything else having read it yet (lazy evaluation, no background
    // scheduler in this codebase) — the dead-letter view must surface it
    // immediately rather than depending on some unrelated prior read.
    this.messages.forEach((m) => this.evaluateLifecycle(m));
    return this.deadLetters.filter((d) => {
      if (filters.organizationId && d.organizationId !== filters.organizationId) return false;
      if (filters.runtimeId && d.runtimeId !== filters.runtimeId) return false;
      return true;
    });
  }

  toDTO(message: MessageRecord): MessageDTO {
    return {
      id: message.id,
      jobId: message.jobId,
      organizationId: message.organizationId,
      runtimeId: message.runtimeId,
      resourceKey: message.resourceKey,
      sequenceNumber: message.sequenceNumber,
      messageType: message.messageType,
      payload: message.payload,
      checksum: message.checksum,
      status: message.status,
      deliveryAttempts: message.deliveryAttempts,
      maxDeliveryAttempts: message.maxDeliveryAttempts,
      correlationId: message.correlationId,
      traceId: message.traceId,
      history: message.history,
      lastError: message.lastError,
      createdAt: message.createdAt,
      scheduledAt: message.scheduledAt,
      sentAt: message.sentAt,
      deliveredAt: message.deliveredAt,
      acknowledgedAt: message.acknowledgedAt,
      finishedAt: message.finishedAt,
      expiresAt: message.expiresAt,
    };
  }

  // ─── Send ────────────────────────────────────────────────────────────────

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const runtime = await runtimeRegistrationStore.getRuntime(input.runtimeId);
    if (!runtime) return { ok: false, error: 'RUNTIME_NOT_FOUND' };
    if (runtime.organizationId !== input.organizationId) {
      return { ok: false, error: 'RUNTIME_ORGANIZATION_MISMATCH' };
    }

    const resourceKey = resolveResourceKey(input.organizationId, input.resourceKey);
    const sequenceNumber = this.nextSequenceNumber(resourceKey);
    const now = new Date();
    const id = randomUUID();
    const payload = input.payload ?? {};
    const checksum = computeMessageChecksum(payload);
    const signature = signMessagePayload(id, checksum);
    const ttlMs = input.ttlMs ?? DEFAULT_TTL_MS;

    const message: MessageRecord = {
      id,
      jobId: input.jobId ?? null,
      organizationId: input.organizationId,
      runtimeId: input.runtimeId,
      resourceKey,
      sequenceNumber,
      messageType: input.messageType,
      payload,
      checksum,
      signature,
      status: 'QUEUED',
      deliveryAttempts: 0,
      maxDeliveryAttempts: input.maxDeliveryAttempts ?? DEFAULT_MAX_DELIVERY_ATTEMPTS,
      ackTimeoutMs: input.ackTimeoutMs ?? DEFAULT_ACK_TIMEOUT_MS,
      correlationId: input.correlationId ?? randomUUID(),
      traceId: input.traceId ?? randomUUID(),
      history: [{ status: 'CREATED', at: now.toISOString(), detail: null }],
      lastError: null,
      lastAckSignature: null,
      createdAt: now.toISOString(),
      scheduledAt: now.toISOString(),
      sentAt: null,
      deliveredAt: null,
      acknowledgedAt: null,
      finishedAt: null,
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };
    this.appendHistory(message, 'QUEUED', null);
    this.messages.push(message);
    return { ok: true, message };
  }

  // ─── Pending poll (Runtime pulls its own eligible + in-flight messages) ──

  /**
   * Returns every message the Runtime should have in hand right now: newly
   * eligible QUEUED messages (transitioned to SENT, respecting per-resourceKey
   * ordering) plus anything already SENT/DELIVERED/ACKNOWLEDGED/EXECUTING for
   * this Runtime — the latter is what lets a Runtime that restarted mid-flight
   * recover its own in-progress work without the Control Plane losing track
   * of it ("recuperação automática").
   */
  pollPendingForRuntime(runtimeId: string): MessageRecord[] {
    const all = this.messages.map((m) => this.evaluateLifecycle(m));
    const forRuntime = all.filter((m) => m.runtimeId === runtimeId);

    const byResourceKey = new Map<string, MessageRecord[]>();
    for (const m of all) {
      const list = byResourceKey.get(m.resourceKey) ?? [];
      list.push(m);
      byResourceKey.set(m.resourceKey, list);
    }

    const now = Date.now();
    const sentAt = new Date().toISOString();
    for (const m of forRuntime) {
      if (m.status !== 'QUEUED') continue;
      if (new Date(m.scheduledAt).getTime() > now) continue;
      const siblings = byResourceKey.get(m.resourceKey) ?? [];
      if (isEligibleToSend(m, siblings)) {
        m.status = 'SENT';
        m.sentAt = sentAt;
        this.appendHistory(m, 'SENT', null);
      }
    }

    return forRuntime.filter(
      (m) =>
        m.status === 'SENT' ||
        m.status === 'DELIVERED' ||
        m.status === 'ACKNOWLEDGED' ||
        m.status === 'EXECUTING'
    );
  }

  // ─── Acknowledge (before execution) ──────────────────────────────────────

  acknowledge(messageId: string, runtimeId: string, signature: string): AcknowledgeResult {
    const message = this.messages.find((m) => m.id === messageId);
    if (!message) return { ok: false, error: 'MESSAGE_NOT_FOUND' };
    if (message.runtimeId !== runtimeId) return { ok: false, error: 'RUNTIME_MISMATCH' };

    // Idempotency: a Runtime may resend the same ACK more than once (e.g.
    // after a network blip) — never re-process a message already past ACK.
    if (message.status !== 'SENT' && message.status !== 'DELIVERED') {
      return { ok: true, message, alreadyAcknowledged: true };
    }

    const now = new Date().toISOString();
    message.deliveredAt = now;
    this.appendHistory(message, 'DELIVERED', null);
    message.acknowledgedAt = now;
    message.lastAckSignature = signature;
    this.appendHistory(message, 'ACKNOWLEDGED', null);

    if (message.jobId) {
      message.status = 'EXECUTING';
      this.appendHistory(message, 'EXECUTING', null);
    } else {
      // No linked Job to await execution of (e.g. PING) — nothing further to
      // track, so the message's journey ends the moment it's acknowledged.
      message.status = 'COMPLETED';
      message.finishedAt = now;
      this.appendHistory(message, 'COMPLETED', null);
    }
    return { ok: true, message, alreadyAcknowledged: false };
  }

  /** True when `signature` was already accepted as this message's ACK — rejects verbatim request replay. */
  isReplayedAckSignature(messageId: string, signature: string): boolean {
    const message = this.messages.find((m) => m.id === messageId);
    return message?.lastAckSignature === signature;
  }

  // ─── Dead letter reprocessing ────────────────────────────────────────────

  reprocessMessage(messageId: string): ReprocessResult {
    const message = this.getMessage(messageId);
    if (!message || message.status !== 'DEAD_LETTER') {
      return { ok: false, error: 'DEAD_LETTER_ENTRY_NOT_FOUND' };
    }

    message.deliveryAttempts = 0;
    message.lastError = null;
    message.finishedAt = null;
    message.sentAt = null;
    message.status = 'QUEUED';
    const now = new Date();
    message.scheduledAt = now.toISOString();
    message.expiresAt = new Date(now.getTime() + DEFAULT_TTL_MS).toISOString();
    this.appendHistory(message, 'QUEUED', 'Requeued for reprocessing from the dead-letter queue');
    return { ok: true, message };
  }
}

export const messageDeliveryStore = MessageDeliveryStore.getInstance();
