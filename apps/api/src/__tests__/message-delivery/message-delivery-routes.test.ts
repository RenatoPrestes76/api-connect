import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  get,
  post,
  bearer,
  superAdminAuth,
  registerActiveRuntimeWithKeys,
  createJob,
  signAck,
  signPendingPoll,
  type TestServer,
} from './helpers.js';
import { signJobResult, SEED_ORG_ID } from '../job-orchestration/helpers.js';
import { adminIdentityStore } from '../../modules/admin-identity/admin-identity-store.js';
import { hashPassword } from '../../modules/admin-identity/password.js';

interface ErrorBody {
  error: { message: string; code: string };
}

interface MessageBody {
  message: {
    id: string;
    status: string;
    resourceKey: string;
    sequenceNumber: number;
    deliveryAttempts: number;
    history: Array<{ status: string }>;
  };
}

let srv: TestServer;
let auth: Record<string, string>;

beforeAll(async () => {
  srv = await startTestServer();
  auth = await superAdminAuth(srv.baseUrl);
});

afterAll(async () => {
  await srv.close();
});

describe('rejects unauthenticated access', () => {
  it('403/401 without a valid admin token and without runtime signature params', async () => {
    const { status } = await get(srv.baseUrl, '/messages/pending');
    expect([401, 403]).toContain(status);
  });
});

describe('POST /messages/send — criação de Message', () => {
  it('creates a queued message', async () => {
    const { runtimeId } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const { status, body } = await post<MessageBody>(
      srv.baseUrl,
      '/messages/send',
      {
        organizationId: SEED_ORG_ID,
        runtimeId,
        messageType: 'PING',
        resourceKey: `rk-create-${Math.random()}`,
      },
      auth
    );
    expect(status).toBe(201);
    expect(body.message.status).toBe('QUEUED');
    expect(body.message.deliveryAttempts).toBe(0);
  });

  it('rejects a Runtime that belongs to a different organization (isolamento)', async () => {
    const { runtimeId } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/messages/send',
      { organizationId: 'org-does-not-match', runtimeId, messageType: 'PING' },
      auth
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('RUNTIME_ORGANIZATION_MISMATCH');
  });
});

describe('Entrega com ACK', () => {
  it('a Runtime polls, receives the message, and acknowledges it before execution', async () => {
    const { runtimeId, keyPair } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const sent = await post<MessageBody>(
      srv.baseUrl,
      '/messages/send',
      {
        organizationId: SEED_ORG_ID,
        runtimeId,
        messageType: 'PING',
        resourceKey: `rk-ack-${Math.random()}`,
      },
      auth
    );
    const messageId = sent.body.message.id;

    const pollTs = new Date().toISOString();
    const pollSig = signPendingPoll(keyPair.privateKeyPem, { runtimeId, timestamp: pollTs });
    const polled = await get<{ total: number; messages: Array<{ id: string; status: string }> }>(
      srv.baseUrl,
      `/messages/pending?runtimeId=${runtimeId}&timestamp=${encodeURIComponent(pollTs)}&signature=${encodeURIComponent(pollSig)}`
    );
    expect(polled.body.total).toBe(1);
    expect(polled.body.messages[0]!.id).toBe(messageId);
    expect(polled.body.messages[0]!.status).toBe('SENT');

    const ackTs = new Date().toISOString();
    const ackSig = signAck(keyPair.privateKeyPem, { messageId, runtimeId, timestamp: ackTs });
    const acked = await post<MessageBody & { alreadyAcknowledged: boolean }>(
      srv.baseUrl,
      '/messages/ack',
      { messageId, runtimeId, timestamp: ackTs, signature: ackSig }
    );
    expect(acked.status).toBe(200);
    expect(acked.body.alreadyAcknowledged).toBe(false);
    // No linked Job — nothing further to await, so it completes right at ACK.
    expect(acked.body.message.status).toBe('COMPLETED');
    expect(acked.body.message.history.map((h) => h.status)).toEqual(
      expect.arrayContaining(['QUEUED', 'SENT', 'DELIVERED', 'ACKNOWLEDGED', 'COMPLETED'])
    );
  });

  it('a message linked to a Job moves to EXECUTING on ACK and syncs to COMPLETED once the Job succeeds', async () => {
    const { runtimeId, keyPair } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const jobId = await createJob(srv.baseUrl, auth, { organizationId: SEED_ORG_ID, runtimeId });
    const sent = await post<MessageBody>(
      srv.baseUrl,
      '/messages/send',
      {
        organizationId: SEED_ORG_ID,
        runtimeId,
        messageType: 'JOB_DISPATCH',
        jobId,
        resourceKey: `rk-jobsync-${Math.random()}`,
      },
      auth
    );
    const messageId = sent.body.message.id;

    const pollTs = new Date().toISOString();
    const pollSig = signPendingPoll(keyPair.privateKeyPem, { runtimeId, timestamp: pollTs });
    await get(
      srv.baseUrl,
      `/messages/pending?runtimeId=${runtimeId}&timestamp=${encodeURIComponent(pollTs)}&signature=${encodeURIComponent(pollSig)}`
    );

    const ackTs = new Date().toISOString();
    const ackSig = signAck(keyPair.privateKeyPem, { messageId, runtimeId, timestamp: ackTs });
    const acked = await post<MessageBody>(srv.baseUrl, '/messages/ack', {
      messageId,
      runtimeId,
      timestamp: ackTs,
      signature: ackSig,
    });
    expect(acked.body.message.status).toBe('EXECUTING');

    const resultTs = new Date().toISOString();
    const resultSig = signJobResult(keyPair.privateKeyPem, {
      jobId,
      runtimeId,
      outcome: 'success',
      timestamp: resultTs,
    });
    await post(srv.baseUrl, '/jobs/result', {
      jobId,
      runtimeId,
      outcome: 'success',
      timestamp: resultTs,
      signature: resultSig,
    });

    const admin = await get<{ messages: Array<{ id: string; status: string }> }>(
      srv.baseUrl,
      `/messages/pending?organizationId=${SEED_ORG_ID}&runtimeId=${runtimeId}`,
      auth
    );
    const synced = admin.body.messages.find((m) => m.id === messageId);
    expect(synced?.status).toBe('COMPLETED');
  });
});

describe('Perda de conexão antes do ACK (timeout de entrega)', () => {
  it('requeues a SENT message that is never acknowledged within its ack timeout', async () => {
    const { runtimeId, keyPair } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const sent = await post<MessageBody>(
      srv.baseUrl,
      '/messages/send',
      {
        organizationId: SEED_ORG_ID,
        runtimeId,
        messageType: 'PING',
        ackTimeoutMs: 50,
        resourceKey: `rk-acktimeout-${Math.random()}`,
      },
      auth
    );
    const messageId = sent.body.message.id;

    const pollTs = new Date().toISOString();
    const pollSig = signPendingPoll(keyPair.privateKeyPem, { runtimeId, timestamp: pollTs });
    await get(
      srv.baseUrl,
      `/messages/pending?runtimeId=${runtimeId}&timestamp=${encodeURIComponent(pollTs)}&signature=${encodeURIComponent(pollSig)}`
    );

    await new Promise((resolve) => setTimeout(resolve, 80));

    const admin = await get<{
      messages: Array<{ id: string; status: string; deliveryAttempts: number }>;
    }>(srv.baseUrl, `/messages/pending?organizationId=${SEED_ORG_ID}&runtimeId=${runtimeId}`, auth);
    const found = admin.body.messages.find((m) => m.id === messageId);
    expect(found?.status).toBe('QUEUED');
    expect(found?.deliveryAttempts).toBe(1);
  });
});

describe('Reinício do Runtime durante execução (recuperação)', () => {
  it('a repeated pending-poll still returns a message that is already in flight', async () => {
    const { runtimeId, keyPair } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const jobId = await createJob(srv.baseUrl, auth, { organizationId: SEED_ORG_ID, runtimeId });
    const sent = await post<MessageBody>(
      srv.baseUrl,
      '/messages/send',
      {
        organizationId: SEED_ORG_ID,
        runtimeId,
        messageType: 'JOB_DISPATCH',
        jobId,
        resourceKey: `rk-recovery-${Math.random()}`,
      },
      auth
    );
    const messageId = sent.body.message.id;

    const poll = async () => {
      const ts = new Date().toISOString();
      const sig = signPendingPoll(keyPair.privateKeyPem, { runtimeId, timestamp: ts });
      return get<{ messages: Array<{ id: string; status: string }> }>(
        srv.baseUrl,
        `/messages/pending?runtimeId=${runtimeId}&timestamp=${encodeURIComponent(ts)}&signature=${encodeURIComponent(sig)}`
      );
    };

    const first = await poll();
    expect(first.body.messages.some((m) => m.id === messageId && m.status === 'SENT')).toBe(true);

    // Simulate a Runtime restart: it polls again before ever acknowledging.
    const second = await poll();
    expect(second.body.messages.some((m) => m.id === messageId)).toBe(true);
  });
});

describe('Mensagens fora de ordem', () => {
  it('only the earliest QUEUED message for a resourceKey is sent; the later one waits', async () => {
    const { runtimeId, keyPair } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const resourceKey = `order-${Math.random()}`;
    const first = await post<MessageBody>(
      srv.baseUrl,
      '/messages/send',
      { organizationId: SEED_ORG_ID, runtimeId, messageType: 'PING', resourceKey },
      auth
    );
    const second = await post<MessageBody>(
      srv.baseUrl,
      '/messages/send',
      { organizationId: SEED_ORG_ID, runtimeId, messageType: 'PING', resourceKey },
      auth
    );
    expect(second.body.message.sequenceNumber).toBeGreaterThan(first.body.message.sequenceNumber);

    const pollTs = new Date().toISOString();
    const pollSig = signPendingPoll(keyPair.privateKeyPem, { runtimeId, timestamp: pollTs });
    const polled = await get<{ messages: Array<{ id: string; status: string }> }>(
      srv.baseUrl,
      `/messages/pending?runtimeId=${runtimeId}&timestamp=${encodeURIComponent(pollTs)}&signature=${encodeURIComponent(pollSig)}`
    );
    const ids = polled.body.messages.map((m) => m.id);
    expect(ids).toContain(first.body.message.id);
    expect(ids).not.toContain(second.body.message.id);
  });
});

describe('Duplicidade de entrega (idempotência de ACK)', () => {
  it('re-acknowledging with a new signature is a no-op; replaying the exact signature is rejected', async () => {
    const { runtimeId, keyPair } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const sent = await post<MessageBody>(
      srv.baseUrl,
      '/messages/send',
      {
        organizationId: SEED_ORG_ID,
        runtimeId,
        messageType: 'PING',
        resourceKey: `rk-dup-${Math.random()}`,
      },
      auth
    );
    const messageId = sent.body.message.id;
    const pollTs = new Date().toISOString();
    const pollSig = signPendingPoll(keyPair.privateKeyPem, { runtimeId, timestamp: pollTs });
    await get(
      srv.baseUrl,
      `/messages/pending?runtimeId=${runtimeId}&timestamp=${encodeURIComponent(pollTs)}&signature=${encodeURIComponent(pollSig)}`
    );

    const ackTs = new Date().toISOString();
    const ackSig = signAck(keyPair.privateKeyPem, { messageId, runtimeId, timestamp: ackTs });
    const ackBody = { messageId, runtimeId, timestamp: ackTs, signature: ackSig };
    const first = await post<MessageBody & { alreadyAcknowledged: boolean }>(
      srv.baseUrl,
      '/messages/ack',
      ackBody
    );
    expect(first.body.alreadyAcknowledged).toBe(false);

    // Exact replay of the same signed request is rejected outright.
    const replay = await post<ErrorBody>(srv.baseUrl, '/messages/ack', ackBody);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('REPLAY_REJECTED');

    // A legitimately new (different) signature for the same message is a
    // silent idempotent no-op instead — proves no double-processing either way.
    const ackTs2 = new Date().toISOString();
    const ackSig2 = signAck(keyPair.privateKeyPem, { messageId, runtimeId, timestamp: ackTs2 });
    const again = await post<MessageBody & { alreadyAcknowledged: boolean }>(
      srv.baseUrl,
      '/messages/ack',
      { messageId, runtimeId, timestamp: ackTs2, signature: ackSig2 }
    );
    expect(again.status).toBe(200);
    expect(again.body.alreadyAcknowledged).toBe(true);
  });
});

describe('Envio para Dead Letter e reprocessamento', () => {
  it('moves an undelivered message to the dead-letter queue once attempts are exhausted, then reprocesses it', async () => {
    const { runtimeId, keyPair } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const sent = await post<MessageBody>(
      srv.baseUrl,
      '/messages/send',
      {
        organizationId: SEED_ORG_ID,
        runtimeId,
        messageType: 'PING',
        maxDeliveryAttempts: 1,
        ackTimeoutMs: 30,
        resourceKey: `rk-dlq-${Math.random()}`,
      },
      auth
    );
    const messageId = sent.body.message.id;

    const pollTs = new Date().toISOString();
    const pollSig = signPendingPoll(keyPair.privateKeyPem, { runtimeId, timestamp: pollTs });
    await get(
      srv.baseUrl,
      `/messages/pending?runtimeId=${runtimeId}&timestamp=${encodeURIComponent(pollTs)}&signature=${encodeURIComponent(pollSig)}`
    );

    await new Promise((resolve) => setTimeout(resolve, 60));

    const dlq = await get<{
      entries: Array<{ messageId: string; reason: string; attempts: number }>;
    }>(srv.baseUrl, '/messages/dead-letter', auth);
    const entry = dlq.body.entries.find((e) => e.messageId === messageId);
    expect(entry).toBeDefined();
    expect(entry?.reason).toBe('ack_timeout_exhausted');
    expect(entry?.attempts).toBe(1);

    const reprocessed = await post<MessageBody>(
      srv.baseUrl,
      '/messages/reprocess',
      { messageId },
      auth
    );
    expect(reprocessed.status).toBe(200);
    expect(reprocessed.body.message.status).toBe('QUEUED');
    expect(reprocessed.body.message.deliveryAttempts).toBe(0);
  });
});

describe('Alta concorrência', () => {
  it('independent resourceKeys for the same Runtime are all sendable in parallel', async () => {
    const { runtimeId, keyPair } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const created = await Promise.all(
      [1, 2, 3].map((n) =>
        post<MessageBody>(
          srv.baseUrl,
          '/messages/send',
          {
            organizationId: SEED_ORG_ID,
            runtimeId,
            messageType: 'PING',
            resourceKey: `concurrent-${n}-${Math.random()}`,
          },
          auth
        )
      )
    );

    const pollTs = new Date().toISOString();
    const pollSig = signPendingPoll(keyPair.privateKeyPem, { runtimeId, timestamp: pollTs });
    const polled = await get<{ messages: Array<{ id: string; status: string }> }>(
      srv.baseUrl,
      `/messages/pending?runtimeId=${runtimeId}&timestamp=${encodeURIComponent(pollTs)}&signature=${encodeURIComponent(pollSig)}`
    );
    for (const c of created) {
      const match = polled.body.messages.find((m) => m.id === c.body.message.id);
      expect(match?.status).toBe('SENT');
    }
  });
});

describe('Isolamento entre organizações', () => {
  it('the admin listing scopes strictly to the requested organizationId', async () => {
    const { runtimeId } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const sent = await post<MessageBody>(
      srv.baseUrl,
      '/messages/send',
      { organizationId: SEED_ORG_ID, runtimeId, messageType: 'PING' },
      auth
    );

    const wrongOrg = await get<{ messages: Array<{ id: string }> }>(
      srv.baseUrl,
      '/messages/pending?organizationId=org-does-not-exist',
      auth
    );
    expect(wrongOrg.body.messages.some((m) => m.id === sent.body.message.id)).toBe(false);

    const rightOrg = await get<{ messages: Array<{ id: string }> }>(
      srv.baseUrl,
      `/messages/pending?organizationId=${SEED_ORG_ID}`,
      auth
    );
    expect(rightOrg.body.messages.some((m) => m.id === sent.body.message.id)).toBe(true);
  });
});

describe('RBAC', () => {
  it('AUDITOR (read-only) is forbidden from sending a message', async () => {
    const role = adminIdentityStore.getRoleByName('AUDITOR')!;
    const password = 'AuditorMsgPass123!';
    const user = adminIdentityStore.createUser({
      name: 'Fresh Auditor Messages',
      email: `auditor-messages-${Date.now()}@atlasconnect.com.br`,
      passwordHash: await hashPassword(password),
      roleId: role.id,
    });
    const login = await post<{ accessToken: string }>(
      srv.baseUrl,
      '/admin/auth/login',
      { email: user.email, password },
      { 'x-forwarded-for': '10.61.9.9' }
    );
    const auditorAuth = bearer(login.body.accessToken);

    const { runtimeId } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/messages/send',
      { organizationId: SEED_ORG_ID, runtimeId, messageType: 'PING' },
      auditorAuth
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

describe('Audit trail', () => {
  it('records MESSAGE_ENQUEUED, MESSAGE_ACKNOWLEDGED, and MESSAGE_REPROCESSED entries', async () => {
    const { runtimeId, keyPair } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const sent = await post<MessageBody>(
      srv.baseUrl,
      '/messages/send',
      {
        organizationId: SEED_ORG_ID,
        runtimeId,
        messageType: 'PING',
        maxDeliveryAttempts: 1,
        ackTimeoutMs: 30,
        resourceKey: `rk-audit1-${Math.random()}`,
      },
      auth
    );
    const messageId = sent.body.message.id;

    const pollTs = new Date().toISOString();
    const pollSig = signPendingPoll(keyPair.privateKeyPem, { runtimeId, timestamp: pollTs });
    await get(
      srv.baseUrl,
      `/messages/pending?runtimeId=${runtimeId}&timestamp=${encodeURIComponent(pollTs)}&signature=${encodeURIComponent(pollSig)}`
    );
    const ackTs = new Date().toISOString();
    const ackSig = signAck(keyPair.privateKeyPem, { messageId, runtimeId, timestamp: ackTs });
    await post(srv.baseUrl, '/messages/ack', {
      messageId,
      runtimeId,
      timestamp: ackTs,
      signature: ackSig,
    });

    const sent2 = await post<MessageBody>(
      srv.baseUrl,
      '/messages/send',
      {
        organizationId: SEED_ORG_ID,
        runtimeId,
        messageType: 'PING',
        maxDeliveryAttempts: 1,
        ackTimeoutMs: 30,
        resourceKey: `rk-audit2-${Math.random()}`,
      },
      auth
    );
    const pollTs2 = new Date().toISOString();
    const pollSig2 = signPendingPoll(keyPair.privateKeyPem, { runtimeId, timestamp: pollTs2 });
    await get(
      srv.baseUrl,
      `/messages/pending?runtimeId=${runtimeId}&timestamp=${encodeURIComponent(pollTs2)}&signature=${encodeURIComponent(pollSig2)}`
    );
    await new Promise((resolve) => setTimeout(resolve, 60));
    await get(srv.baseUrl, '/messages/dead-letter', auth);
    await post(srv.baseUrl, '/messages/reprocess', { messageId: sent2.body.message.id }, auth);

    const log = adminIdentityStore.getAuditLog({ limit: 500 });
    expect(log.some((e) => e.action === 'MESSAGE_ENQUEUED' && e.target === messageId)).toBe(true);
    expect(log.some((e) => e.action === 'MESSAGE_ACKNOWLEDGED' && e.target === messageId)).toBe(
      true
    );
    expect(
      log.some((e) => e.action === 'MESSAGE_REPROCESSED' && e.target === sent2.body.message.id)
    ).toBe(true);
  });
});
