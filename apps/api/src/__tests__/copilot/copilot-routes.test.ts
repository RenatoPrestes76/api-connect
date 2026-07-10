import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { TestCopilotServer } from './helpers.js';
import { startCopilotServer, stopServer, get, post, del } from './helpers.js';

let srv: TestCopilotServer;

beforeAll(async () => {
  srv = await startCopilotServer();
});
afterAll(async () => {
  await stopServer(srv.server);
});

// ─── GET /api/v1/copilot/conversations ───────────────────────────────────────

describe('GET /api/v1/copilot/conversations', () => {
  it('returns seeded conversations', async () => {
    const { status, body } = await get<{ items: unknown[]; total: number }>(
      srv.baseUrl,
      '/api/v1/copilot/conversations'
    );
    expect(status).toBe(200);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(2);
  });

  it('each conversation has required fields', async () => {
    const { body } = await get<{ items: Array<Record<string, unknown>> }>(
      srv.baseUrl,
      '/api/v1/copilot/conversations'
    );
    const conv = body.items[0]!;
    expect(conv).toHaveProperty('id');
    expect(conv).toHaveProperty('title');
    expect(conv).toHaveProperty('context');
    expect(conv).toHaveProperty('messageCount');
    expect(conv).toHaveProperty('createdAt');
    expect(conv).toHaveProperty('updatedAt');
  });

  it('is sorted by updatedAt desc', async () => {
    const { body } = await get<{ items: Array<{ updatedAt: string }> }>(
      srv.baseUrl,
      '/api/v1/copilot/conversations'
    );
    const dates = body.items.map((i) => Date.parse(i.updatedAt));
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i]!).toBeGreaterThanOrEqual(dates[i + 1]!);
    }
  });
});

// ─── GET /api/v1/copilot/conversations/:id ───────────────────────────────────

describe('GET /api/v1/copilot/conversations/:id', () => {
  it('returns 404 for unknown id', async () => {
    const { status } = await get(srv.baseUrl, '/api/v1/copilot/conversations/nonexistent');
    expect(status).toBe(404);
  });

  it('returns conversation with messages by id', async () => {
    const { body: list } = await get<{ items: Array<{ id: string }> }>(
      srv.baseUrl,
      '/api/v1/copilot/conversations'
    );
    const id = list.items[0]!.id;
    const { status, body } = await get<{ id: string; messages: unknown[] }>(
      srv.baseUrl,
      `/api/v1/copilot/conversations/${id}`
    );
    expect(status).toBe(200);
    expect(body.id).toBe(id);
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages.length).toBeGreaterThan(0);
  });
});

// ─── POST /api/v1/copilot/chat ───────────────────────────────────────────────

describe('POST /api/v1/copilot/chat', () => {
  it('returns 400 when message is missing', async () => {
    const { status } = await post(srv.baseUrl, '/api/v1/copilot/chat', {});
    expect(status).toBe(400);
  });

  it('returns 400 when message is empty string', async () => {
    const { status } = await post(srv.baseUrl, '/api/v1/copilot/chat', { message: '   ' });
    expect(status).toBe(400);
  });

  it('creates a new conversation and returns AI response', async () => {
    const { status, body } = await post<{
      conversationId: string;
      messageId: string;
      content: string;
      model: string;
    }>(srv.baseUrl, '/api/v1/copilot/chat', { message: 'What is the system status?' });
    expect(status).toBe(200);
    expect(body.conversationId).toBeTruthy();
    expect(body.messageId).toBeTruthy();
    expect(typeof body.content).toBe('string');
    expect(body.content.length).toBeGreaterThan(0);
    expect(body.model).toBe('demo');
  });

  it('continues an existing conversation', async () => {
    // Create first message
    const { body: first } = await post<{ conversationId: string }>(
      srv.baseUrl,
      '/api/v1/copilot/chat',
      { message: 'Hello, Copilot!' }
    );
    const convId = first.conversationId;

    // Send follow-up
    const { status, body } = await post<{ conversationId: string; content: string }>(
      srv.baseUrl,
      '/api/v1/copilot/chat',
      { message: 'What can you help with?', conversationId: convId }
    );
    expect(status).toBe(200);
    expect(body.conversationId).toBe(convId);
    expect(body.content.length).toBeGreaterThan(0);
  });

  it('stores messages in the conversation', async () => {
    const { body: chatRes } = await post<{ conversationId: string }>(
      srv.baseUrl,
      '/api/v1/copilot/chat',
      { message: 'Diagnose my workflow sync failures' }
    );
    const convId = chatRes.conversationId;

    const { body: conv } = await get<{ messages: Array<{ role: string; content: string }> }>(
      srv.baseUrl,
      `/api/v1/copilot/conversations/${convId}`
    );
    expect(conv.messages.length).toBeGreaterThanOrEqual(2);
    expect(conv.messages.some((m) => m.role === 'user')).toBe(true);
    expect(conv.messages.some((m) => m.role === 'assistant')).toBe(true);
  });

  it('sets conversation title from first message', async () => {
    const msg = 'How do I configure retry for HTTP nodes?';
    const { body: chatRes } = await post<{ conversationId: string }>(
      srv.baseUrl,
      '/api/v1/copilot/chat',
      { message: msg }
    );

    const { body: conv } = await get<{ title: string }>(
      srv.baseUrl,
      `/api/v1/copilot/conversations/${chatRes.conversationId}`
    );
    expect(conv.title).toContain('How do I configure');
  });
});

// ─── DELETE /api/v1/copilot/conversations/:id ────────────────────────────────

describe('DELETE /api/v1/copilot/conversations/:id', () => {
  it('returns 404 for unknown id', async () => {
    const { status } = await del(srv.baseUrl, '/api/v1/copilot/conversations/nonexistent');
    expect(status).toBe(404);
  });

  it('deletes a conversation', async () => {
    const { body: created } = await post<{ conversationId: string }>(
      srv.baseUrl,
      '/api/v1/copilot/chat',
      { message: 'Temp conversation for deletion' }
    );
    const id = created.conversationId;

    const { status } = await del(srv.baseUrl, `/api/v1/copilot/conversations/${id}`);
    expect(status).toBe(204);

    const { status: get404 } = await get(srv.baseUrl, `/api/v1/copilot/conversations/${id}`);
    expect(get404).toBe(404);
  });
});

// ─── POST /api/v1/copilot/diagnose ──────────────────────────────────────────

describe('POST /api/v1/copilot/diagnose', () => {
  it('returns 400 when question is missing', async () => {
    const { status } = await post(srv.baseUrl, '/api/v1/copilot/diagnose', {});
    expect(status).toBe(400);
  });

  it('returns diagnosis with required fields', async () => {
    const { status, body } = await post<{
      diagnosis: string;
      severity: string;
      suggestions: unknown[];
      model: string;
    }>(srv.baseUrl, '/api/v1/copilot/diagnose', { question: 'Why did the ERP sync fail?' });
    expect(status).toBe(200);
    expect(typeof body.diagnosis).toBe('string');
    expect(['low', 'medium', 'high', 'critical']).toContain(body.severity);
    expect(Array.isArray(body.suggestions)).toBe(true);
    expect(body.suggestions.length).toBeGreaterThan(0);
    expect(body.model).toBe('demo');
  });

  it('each suggestion has step, action, description', async () => {
    const { body } = await post<{ suggestions: Array<Record<string, unknown>> }>(
      srv.baseUrl,
      '/api/v1/copilot/diagnose',
      { question: 'Agents without heartbeat' }
    );
    const s = body.suggestions[0]!;
    expect(typeof s['step']).toBe('number');
    expect(typeof s['action']).toBe('string');
    expect(typeof s['description']).toBe('string');
  });
});

// ─── POST /api/v1/copilot/generate ──────────────────────────────────────────

describe('POST /api/v1/copilot/generate', () => {
  it('returns 400 for invalid type', async () => {
    const { status } = await post(srv.baseUrl, '/api/v1/copilot/generate', {
      type: 'invalid',
      description: 'x',
    });
    expect(status).toBe(400);
  });

  it('returns 400 when description is missing', async () => {
    const { status } = await post(srv.baseUrl, '/api/v1/copilot/generate', { type: 'sql' });
    expect(status).toBe(400);
  });

  it('generates a mapping', async () => {
    const { status, body } = await post<{
      type: string;
      title: string;
      code?: string;
      model: string;
    }>(srv.baseUrl, '/api/v1/copilot/generate', {
      type: 'mapping',
      description: 'Map ERP customers to Atlas',
    });
    expect(status).toBe(200);
    expect(body.type).toBe('mapping');
    expect(typeof body.title).toBe('string');
    expect(body.model).toBe('demo');
  });

  it('generates SQL', async () => {
    const { status, body } = await post<{ type: string; code: string; language: string }>(
      srv.baseUrl,
      '/api/v1/copilot/generate',
      { type: 'sql', description: 'Products updated today' }
    );
    expect(status).toBe(200);
    expect(body.type).toBe('sql');
    expect(typeof body.code).toBe('string');
    expect(body.language).toBe('sql');
  });

  it('generates a workflow flow', async () => {
    const { status, body } = await post<{ type: string; result: Record<string, unknown> }>(
      srv.baseUrl,
      '/api/v1/copilot/generate',
      { type: 'flow', description: 'Sync orders from ERP to Atlas' }
    );
    expect(status).toBe(200);
    expect(body.type).toBe('flow');
    expect(body.result).toHaveProperty('graph');
  });
});

// ─── POST /api/v1/copilot/explain ────────────────────────────────────────────

describe('POST /api/v1/copilot/explain', () => {
  it('returns 400 for invalid type', async () => {
    const { status } = await post(srv.baseUrl, '/api/v1/copilot/explain', { type: 'unknown' });
    expect(status).toBe(400);
  });

  it('returns explanation with summary and explanation fields', async () => {
    const { status, body } = await post<{ summary: string; explanation: string; model: string }>(
      srv.baseUrl,
      '/api/v1/copilot/explain',
      { type: 'workflow', description: 'ERP Product Sync workflow' }
    );
    expect(status).toBe(200);
    expect(typeof body.summary).toBe('string');
    expect(body.summary.length).toBeGreaterThan(0);
    expect(typeof body.explanation).toBe('string');
    expect(body.model).toBe('demo');
  });

  it('returns components array for mapping type', async () => {
    const { body } = await post<{ components?: unknown[] }>(
      srv.baseUrl,
      '/api/v1/copilot/explain',
      { type: 'mapping', description: 'Entity field mapping' }
    );
    expect(Array.isArray(body.components)).toBe(true);
  });
});

// ─── POST /api/v1/copilot/search ─────────────────────────────────────────────

describe('POST /api/v1/copilot/search', () => {
  it('returns 400 when query is missing', async () => {
    const { status } = await post(srv.baseUrl, '/api/v1/copilot/search', {});
    expect(status).toBe(400);
  });

  it('returns results for a keyword search', async () => {
    const { status, body } = await post<{
      query: string;
      results: unknown[];
      total: number;
      model: string;
    }>(srv.baseUrl, '/api/v1/copilot/search', { query: 'ERP connector products' });
    expect(status).toBe(200);
    expect(body.query).toBe('ERP connector products');
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(0);
    expect(body.model).toBe('demo');
  });

  it('each result has type, title, description, relevance', async () => {
    const { body } = await post<{ results: Array<Record<string, unknown>> }>(
      srv.baseUrl,
      '/api/v1/copilot/search',
      { query: 'workflow sync' }
    );
    if (body.results.length > 0) {
      const r = body.results[0]!;
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('type');
      expect(r).toHaveProperty('title');
      expect(r).toHaveProperty('description');
      expect(r).toHaveProperty('relevance');
    }
  });

  it('respects entity type filter', async () => {
    const { body } = await post<{ results: Array<{ type: string }> }>(
      srv.baseUrl,
      '/api/v1/copilot/search',
      { query: 'connector', entities: ['connectors'] }
    );
    body.results.forEach((r) => expect(r.type).toBe('connectors'));
  });

  it('respects limit', async () => {
    const { body } = await post<{ results: unknown[] }>(srv.baseUrl, '/api/v1/copilot/search', {
      query: 'ERP',
      limit: 3,
    });
    expect(body.results.length).toBeLessThanOrEqual(3);
  });
});

// ─── GET /api/v1/copilot/audit ───────────────────────────────────────────────

describe('GET /api/v1/copilot/audit', () => {
  it('returns seeded audit logs', async () => {
    const { status, body } = await get<{ items: unknown[]; total: number }>(
      srv.baseUrl,
      '/api/v1/copilot/audit'
    );
    expect(status).toBe(200);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(10);
  });

  it('each audit log has required fields', async () => {
    const { body } = await get<{ items: Array<Record<string, unknown>> }>(
      srv.baseUrl,
      '/api/v1/copilot/audit'
    );
    const log = body.items[0]!;
    expect(log).toHaveProperty('id');
    expect(log).toHaveProperty('timestamp');
    expect(log).toHaveProperty('action');
    expect(log).toHaveProperty('prompt');
    expect(log).toHaveProperty('responsePreview');
    expect(log).toHaveProperty('modelUsed');
  });

  it('is sorted by timestamp desc', async () => {
    const { body } = await get<{ items: Array<{ timestamp: string }> }>(
      srv.baseUrl,
      '/api/v1/copilot/audit'
    );
    const dates = body.items.map((l) => Date.parse(l.timestamp));
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i]!).toBeGreaterThanOrEqual(dates[i + 1]!);
    }
  });

  it('filters by action', async () => {
    const { body } = await get<{ items: Array<{ action: string }> }>(
      srv.baseUrl,
      '/api/v1/copilot/audit?action=chat'
    );
    body.items.forEach((l) => expect(l.action).toBe('chat'));
  });

  it('filters by action=diagnose', async () => {
    const { body } = await get<{ items: Array<{ action: string }> }>(
      srv.baseUrl,
      '/api/v1/copilot/audit?action=diagnose'
    );
    body.items.forEach((l) => expect(l.action).toBe('diagnose'));
  });

  it('respects limit and offset', async () => {
    const { body } = await get<{ items: unknown[]; limit: number; offset: number }>(
      srv.baseUrl,
      '/api/v1/copilot/audit?limit=3&offset=0'
    );
    expect(body.items.length).toBeLessThanOrEqual(3);
    expect(body.limit).toBe(3);
    expect(body.offset).toBe(0);
  });

  it('audit log is written after chat', async () => {
    const { body: before } = await get<{ total: number }>(srv.baseUrl, '/api/v1/copilot/audit');
    await post(srv.baseUrl, '/api/v1/copilot/chat', { message: 'Audit log test message' });
    const { body: after } = await get<{ total: number }>(srv.baseUrl, '/api/v1/copilot/audit');
    expect(after.total).toBeGreaterThan(before.total);
  });

  it('audit log is written after diagnose', async () => {
    const { body: before } = await get<{ total: number }>(
      srv.baseUrl,
      '/api/v1/copilot/audit?action=diagnose'
    );
    await post(srv.baseUrl, '/api/v1/copilot/diagnose', { question: 'Any SLA breaches?' });
    const { body: after } = await get<{ total: number }>(
      srv.baseUrl,
      '/api/v1/copilot/audit?action=diagnose'
    );
    expect(after.total).toBeGreaterThan(before.total);
  });

  it('audit log is written after search', async () => {
    const { body: before } = await get<{ total: number }>(
      srv.baseUrl,
      '/api/v1/copilot/audit?action=search'
    );
    await post(srv.baseUrl, '/api/v1/copilot/search', { query: 'audit test search' });
    const { body: after } = await get<{ total: number }>(
      srv.baseUrl,
      '/api/v1/copilot/audit?action=search'
    );
    expect(after.total).toBeGreaterThan(before.total);
  });
});
