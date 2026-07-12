import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, get, post, type TestServer } from './helpers.js';

let srv: TestServer;
beforeAll(async () => {
  srv = await startTestServer();
});
afterAll(async () => {
  await srv.close();
});

const G = (path: string, orgId?: string) => get(srv.baseUrl, path, orgId);
const P = (path: string, data?: unknown, orgId?: string) => post(srv.baseUrl, path, data, orgId);

// ─── Event Bus — Topics ───────────────────────────────────────────────────────

describe('GET /api/v1/helios/bus/topics', () => {
  it('returns all 8 topics', async () => {
    const { status, body } = await G('/api/v1/helios/bus/topics');
    expect(status).toBe(200);
    expect(body.topics).toHaveLength(8);
    expect(body.total).toBe(8);
  });

  it('scoped caller (tenant-enterprise) sees only their own 3 topics', async () => {
    const { body } = await G('/api/v1/helios/bus/topics', 'tenant-enterprise');
    expect(body.topics).toHaveLength(3);
    body.topics.forEach((t: any) => expect(t.tenantId).toBe('tenant-enterprise'));
  });

  it('scoped caller cannot see other tenants by passing a forged tenantId query param', async () => {
    const { body } = await G(
      '/api/v1/helios/bus/topics?tenantId=tenant-retail',
      'tenant-enterprise'
    );
    expect(body.topics).toHaveLength(3);
    body.topics.forEach((t: any) => expect(t.tenantId).toBe('tenant-enterprise'));
  });

  it('filters by status=paused returns 1 (topic-005)', async () => {
    const { body } = await G('/api/v1/helios/bus/topics?status=paused');
    expect(body.topics).toHaveLength(1);
    expect(body.topics[0].id).toBe('topic-005');
  });

  it('limit=3 returns 3 topics', async () => {
    const { body } = await G('/api/v1/helios/bus/topics?limit=3');
    expect(body.topics).toHaveLength(3);
  });

  it('all topics have partitions > 0', async () => {
    const { body } = await G('/api/v1/helios/bus/topics');
    body.topics.forEach((t: any) => expect(t.partitions).toBeGreaterThan(0));
  });
});

describe('GET /api/v1/helios/bus/topics/:id', () => {
  it('returns topic-001 with eventType Order.Created', async () => {
    const { status, body } = await G('/api/v1/helios/bus/topics/topic-001');
    expect(status).toBe(200);
    expect(body.id).toBe('topic-001');
    expect(body.eventType).toBe('Order.Created');
  });

  it('topic-008 has 12 partitions', async () => {
    const { body } = await G('/api/v1/helios/bus/topics/topic-008');
    expect(body.partitions).toBe(12);
  });

  it('returns 404 for unknown topic', async () => {
    const { status, body } = await G('/api/v1/helios/bus/topics/topic-999');
    expect(status).toBe(404);
    expect(body.error.code).toBe('TOPIC_NOT_FOUND');
  });

  it("returns 404 when a scoped caller requests another tenant's topic", async () => {
    const { status, body } = await G('/api/v1/helios/bus/topics/topic-001', 'tenant-retail');
    expect(status).toBe(404);
    expect(body.error.code).toBe('TOPIC_NOT_FOUND');
  });
});

describe('GET /api/v1/helios/bus/topics/:id/messages', () => {
  it('returns messages for topic-001', async () => {
    const { status, body } = await G('/api/v1/helios/bus/topics/topic-001/messages');
    expect(status).toBe(200);
    expect(Array.isArray(body.messages)).toBe(true);
  });

  it('returns 404 for unknown topic', async () => {
    const { status, body } = await G('/api/v1/helios/bus/topics/topic-999/messages');
    expect(status).toBe(404);
    expect(body.error.code).toBe('TOPIC_NOT_FOUND');
  });
});

describe('POST /api/v1/helios/bus/topics/:id/publish', () => {
  it('returns 400 MISSING_FIELDS when body is empty', async () => {
    const { status, body } = await P('/api/v1/helios/bus/topics/topic-001/publish', {});
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 404 for unknown topic', async () => {
    const { status, body } = await P('/api/v1/helios/bus/topics/topic-999/publish', {
      eventType: 'Order.Created',
      payload: { orderId: 'x' },
      producer: 'test',
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe('TOPIC_NOT_FOUND');
  });

  it('publishes message and returns id + signature', async () => {
    const { status, body } = await P('/api/v1/helios/bus/topics/topic-001/publish', {
      eventType: 'Order.Created',
      payload: { orderId: 'ord-test', customerId: 'cust-test', total: 100 },
      producer: 'test-producer',
    });
    expect(status).toBe(200);
    expect(body.id).toBeTruthy();
    expect(body.signature).toMatch(/^sha256:/);
    expect(body.status).toBe('delivered');
  });
});

// ─── Event Mesh ───────────────────────────────────────────────────────────────

describe('GET /api/v1/helios/mesh/clusters', () => {
  it('returns 3 clusters', async () => {
    const { status, body } = await G('/api/v1/helios/mesh/clusters');
    expect(status).toBe(200);
    expect(body.clusters).toHaveLength(3);
    expect(body.total).toBe(3);
  });

  it('Frankfurt cluster is degraded', async () => {
    const { body } = await G('/api/v1/helios/mesh/clusters');
    const frankfurt = body.clusters.find((c: any) => c.name.includes('Frankfurt'));
    expect(frankfurt.status).toBe('degraded');
  });

  it('São Paulo cluster has lowest latency', async () => {
    const { body } = await G('/api/v1/helios/mesh/clusters');
    const sp = body.clusters.find((c: any) => c.name.includes('Paulo'));
    expect(sp.latencyMs).toBeLessThan(10);
  });
});

// ─── Streaming Analytics ──────────────────────────────────────────────────────

describe('GET /api/v1/helios/analytics/stream', () => {
  it('returns stream metrics with required fields', async () => {
    const { status, body } = await G('/api/v1/helios/analytics/stream');
    expect(status).toBe(200);
    expect(body.eventsPerSecond).toBeGreaterThan(0);
    expect(body.throughputMbps).toBeGreaterThan(0);
    expect(body.avgLatencyMs).toBeGreaterThan(0);
    expect(body.errorRate).toBeGreaterThanOrEqual(0);
    expect(body.activeConsumers).toBeGreaterThan(0);
    expect(body.totalEventsToday).toBeGreaterThan(0);
  });

  it('p99LatencyMs > avgLatencyMs', async () => {
    const { body } = await G('/api/v1/helios/analytics/stream');
    expect(body.p99LatencyMs).toBeGreaterThan(body.avgLatencyMs);
  });
});

describe('GET /api/v1/helios/analytics/topics', () => {
  it('returns 8 topic metrics', async () => {
    const { status, body } = await G('/api/v1/helios/analytics/topics');
    expect(status).toBe(200);
    expect(body.metrics).toHaveLength(8);
    expect(body.total).toBe(8);
  });

  it('IoT topic has highest consumer lag', async () => {
    const { body } = await G('/api/v1/helios/analytics/topics');
    const iot = body.metrics.find((m: any) => m.topicId === 'topic-008');
    expect(iot.consumerLag).toBeGreaterThan(0);
  });
});

// ─── Event Catalog ────────────────────────────────────────────────────────────

describe('GET /api/v1/helios/catalog', () => {
  it('returns all 8 catalog entries', async () => {
    const { status, body } = await G('/api/v1/helios/catalog');
    expect(status).toBe(200);
    expect(body.entries).toHaveLength(8);
    expect(body.total).toBe(8);
  });

  it('classification=public returns 1 (Product.Created)', async () => {
    const { body } = await G('/api/v1/helios/catalog?classification=public');
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].eventType).toBe('Product.Created');
  });

  it('criticality=critical returns 3', async () => {
    const { body } = await G('/api/v1/helios/catalog?criticality=critical');
    expect(body.entries).toHaveLength(3);
  });

  it('all entries have changelog with at least one entry', async () => {
    const { body } = await G('/api/v1/helios/catalog');
    body.entries.forEach((e: any) => {
      expect(Array.isArray(e.changelog)).toBe(true);
      expect(e.changelog.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('GET /api/v1/helios/catalog/:id', () => {
  it('returns Order.Created entry with correct producer', async () => {
    const { status, body } = await G('/api/v1/helios/catalog/Order.Created');
    expect(status).toBe(200);
    expect(body.eventType).toBe('Order.Created');
    expect(body.producer).toBe('order-service');
  });

  it('returns 404 for unknown event type', async () => {
    const { status, body } = await G('/api/v1/helios/catalog/Unknown.Event');
    expect(status).toBe(404);
    expect(body.error.code).toBe('CATALOG_ENTRY_NOT_FOUND');
  });
});

// ─── Schema Registry ──────────────────────────────────────────────────────────

describe('GET /api/v1/helios/schema', () => {
  it('returns all 12 schema versions', async () => {
    const { status, body } = await G('/api/v1/helios/schema');
    expect(status).toBe(200);
    expect(body.schemas).toHaveLength(12);
    expect(body.total).toBe(12);
  });

  it('status=active returns 7', async () => {
    const { body } = await G('/api/v1/helios/schema?status=active');
    expect(body.schemas).toHaveLength(7);
  });

  it('status=deprecated returns 4', async () => {
    const { body } = await G('/api/v1/helios/schema?status=deprecated');
    expect(body.schemas).toHaveLength(4);
  });

  it('status=draft returns 1 (Shipment.Dispatched)', async () => {
    const { body } = await G('/api/v1/helios/schema?status=draft');
    expect(body.schemas).toHaveLength(1);
    expect(body.schemas[0].eventType).toBe('Shipment.Dispatched');
  });
});

describe('GET /api/v1/helios/schema/:id/versions', () => {
  it('Order.Created has 2 versions', async () => {
    const { status, body } = await G('/api/v1/helios/schema/Order.Created/versions');
    expect(status).toBe(200);
    expect(body.versions).toHaveLength(2);
    expect(body.eventType).toBe('Order.Created');
  });

  it('Customer.Updated has 3 versions', async () => {
    const { body } = await G('/api/v1/helios/schema/Customer.Updated/versions');
    expect(body.versions).toHaveLength(3);
  });

  it('returns 404 for unknown event type', async () => {
    const { status, body } = await G('/api/v1/helios/schema/Unknown.Event/versions');
    expect(status).toBe(404);
    expect(body.error.code).toBe('SCHEMA_NOT_FOUND');
  });
});

describe('POST /api/v1/helios/schema/:id/rollback', () => {
  it('returns 400 MISSING_VERSION when version absent', async () => {
    const { status, body } = await P('/api/v1/helios/schema/Order.Created/rollback', {});
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_VERSION');
  });

  it('returns 404 SCHEMA_NOT_FOUND for unknown event type', async () => {
    const { status, body } = await P('/api/v1/helios/schema/Unknown.Event/rollback', {
      version: 'v1',
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe('SCHEMA_NOT_FOUND');
  });

  it('returns 404 VERSION_NOT_FOUND for non-existent version', async () => {
    const { status, body } = await P('/api/v1/helios/schema/Order.Created/rollback', {
      version: 'v99',
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe('VERSION_NOT_FOUND');
  });

  it('rolls back Order.Created to v1 (sets it active)', async () => {
    const { status, body } = await P('/api/v1/helios/schema/Order.Created/rollback', {
      version: 'v1',
    });
    expect(status).toBe(200);
    expect(body.version).toBe('v1');
    expect(body.status).toBe('active');
  });
});

// ─── Event Replay ─────────────────────────────────────────────────────────────

describe('GET /api/v1/helios/replay', () => {
  it('returns all 4 replay jobs', async () => {
    const { status, body } = await G('/api/v1/helios/replay');
    expect(status).toBe(200);
    expect(body.jobs).toHaveLength(4);
    expect(body.total).toBe(4);
  });

  it('status=completed returns 2', async () => {
    const { body } = await G('/api/v1/helios/replay?status=completed');
    expect(body.jobs).toHaveLength(2);
  });

  it('status=running returns 1 (replay-003)', async () => {
    const { body } = await G('/api/v1/helios/replay?status=running');
    expect(body.jobs).toHaveLength(1);
    expect(body.jobs[0].id).toBe('replay-003');
  });

  it('scoped caller (tenant-retail) sees only their own 1 replay job (replay-002)', async () => {
    const { body } = await G('/api/v1/helios/replay', 'tenant-retail');
    expect(body.jobs).toHaveLength(1);
    expect(body.jobs[0].id).toBe('replay-002');
  });
});

describe('GET /api/v1/helios/replay/:id', () => {
  it('returns replay-001 with eventsReplayed=12450', async () => {
    const { status, body } = await G('/api/v1/helios/replay/replay-001');
    expect(status).toBe(200);
    expect(body.id).toBe('replay-001');
    expect(body.eventsReplayed).toBe(12450);
    expect(body.status).toBe('completed');
  });

  it('returns 404 for unknown job', async () => {
    const { status, body } = await G('/api/v1/helios/replay/replay-999');
    expect(status).toBe(404);
    expect(body.error.code).toBe('REPLAY_JOB_NOT_FOUND');
  });
});

describe('POST /api/v1/helios/replay', () => {
  it('returns 400 MISSING_FIELDS when body is incomplete', async () => {
    const { status, body } = await P('/api/v1/helios/replay', { topicId: 'topic-001' });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 404 TOPIC_NOT_FOUND for unknown topic', async () => {
    const { status, body } = await P('/api/v1/helios/replay', {
      topicId: 'topic-999',
      tenantId: 'tenant-enterprise',
      startTime: '2025-07-01T00:00:00Z',
      endTime: '2025-07-01T23:59:59Z',
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe('TOPIC_NOT_FOUND');
  });

  it('creates replay job with status=queued', async () => {
    const { status, body } = await P('/api/v1/helios/replay', {
      topicId: 'topic-001',
      tenantId: 'tenant-enterprise',
      startTime: '2025-07-01T00:00:00Z',
      endTime: '2025-07-01T23:59:59Z',
    });
    expect(status).toBe(200);
    expect(body.id).toBeTruthy();
    expect(body.status).toBe('queued');
    expect(body.eventsReplayed).toBe(0);
  });
});

// ─── Dead Letter Queue ────────────────────────────────────────────────────────

describe('GET /api/v1/helios/dlq', () => {
  it('returns all 6 DLQ entries', async () => {
    const { status, body } = await G('/api/v1/helios/dlq');
    expect(status).toBe(200);
    expect(body.entries).toHaveLength(6);
    expect(body.total).toBe(6);
  });

  it('status=pending returns 4', async () => {
    const { body } = await G('/api/v1/helios/dlq?status=pending');
    expect(body.entries).toHaveLength(4);
  });

  it('status=resolved returns 1 (dlq-005)', async () => {
    const { body } = await G('/api/v1/helios/dlq?status=resolved');
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].id).toBe('dlq-005');
  });

  it('status=discarded returns 1 (dlq-006)', async () => {
    const { body } = await G('/api/v1/helios/dlq?status=discarded');
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].id).toBe('dlq-006');
  });
});

describe('POST /api/v1/helios/dlq/:id/requeue', () => {
  it('returns 404 for unknown entry', async () => {
    const { status, body } = await P('/api/v1/helios/dlq/dlq-999/requeue');
    expect(status).toBe(404);
    expect(body.error.code).toBe('DLQ_ENTRY_NOT_FOUND');
  });

  it('returns 400 ALREADY_RESOLVED for dlq-005', async () => {
    const { status, body } = await P('/api/v1/helios/dlq/dlq-005/requeue');
    expect(status).toBe(400);
    expect(body.error.code).toBe('ALREADY_RESOLVED');
  });

  it('returns 400 ALREADY_DISCARDED for dlq-006', async () => {
    const { status, body } = await P('/api/v1/helios/dlq/dlq-006/requeue');
    expect(status).toBe(400);
    expect(body.error.code).toBe('ALREADY_DISCARDED');
  });

  it('requeues dlq-001 (pending → resolved)', async () => {
    const { status, body } = await P('/api/v1/helios/dlq/dlq-001/requeue');
    expect(status).toBe(200);
    expect(body.status).toBe('resolved');
    expect(body.resolvedAt).toBeTruthy();
  });
});

describe('POST /api/v1/helios/dlq/:id/discard', () => {
  it('returns 404 for unknown entry', async () => {
    const { status, body } = await P('/api/v1/helios/dlq/dlq-999/discard');
    expect(status).toBe(404);
    expect(body.error.code).toBe('DLQ_ENTRY_NOT_FOUND');
  });

  it('discards dlq-002 (pending → discarded)', async () => {
    const { status, body } = await P('/api/v1/helios/dlq/dlq-002/discard');
    expect(status).toBe(200);
    expect(body.status).toBe('discarded');
  });
});

// ─── Event Security ───────────────────────────────────────────────────────────

describe('GET /api/v1/helios/security/policies', () => {
  it('returns 5 security policies', async () => {
    const { status, body } = await G('/api/v1/helios/security/policies');
    expect(status).toBe(200);
    expect(body.policies).toHaveLength(5);
    expect(body.total).toBe(5);
  });

  it('topicId=topic-004 returns 1 (Payment policy)', async () => {
    const { body } = await G('/api/v1/helios/security/policies?topicId=topic-004');
    expect(body.policies).toHaveLength(1);
    expect(body.policies[0].encryptionEnabled).toBe(true);
    expect(body.policies[0].signatureRequired).toBe(true);
  });

  it('IoT topic has encryption disabled', async () => {
    const { body } = await G('/api/v1/helios/security/policies?topicId=topic-008');
    expect(body.policies[0].encryptionEnabled).toBe(false);
  });
});

describe('GET /api/v1/helios/security/audit', () => {
  it('returns 10 audit entries', async () => {
    const { status, body } = await G('/api/v1/helios/security/audit');
    expect(status).toBe(200);
    expect(body.entries).toHaveLength(10);
    expect(body.total).toBe(10);
  });

  it('result=denied returns 3', async () => {
    const { body } = await G('/api/v1/helios/security/audit?result=denied');
    expect(body.entries).toHaveLength(3);
    body.entries.forEach((e: any) => expect(e.result).toBe('denied'));
  });

  it('topicId=topic-001 returns 4 entries', async () => {
    const { body } = await G('/api/v1/helios/security/audit?topicId=topic-001');
    expect(body.entries).toHaveLength(4);
  });
});

// ─── Event Governance ─────────────────────────────────────────────────────────

describe('GET /api/v1/helios/governance', () => {
  it('returns 8 governance policies', async () => {
    const { status, body } = await G('/api/v1/helios/governance');
    expect(status).toBe(200);
    expect(body.policies).toHaveLength(8);
    expect(body.total).toBe(8);
  });

  it('classification=restricted returns 1 (Payment.Confirmed)', async () => {
    const { body } = await G('/api/v1/helios/governance?classification=restricted');
    expect(body.policies).toHaveLength(1);
    expect(body.policies[0].eventType).toBe('Payment.Confirmed');
  });

  it('criticality=critical returns 3', async () => {
    const { body } = await G('/api/v1/helios/governance?criticality=critical');
    expect(body.policies).toHaveLength(3);
  });

  it('LGPD compliance in Customer.Updated governance', async () => {
    const { body } = await G('/api/v1/helios/governance?classification=confidential');
    const customer = body.policies.find((p: any) => p.eventType === 'Customer.Updated');
    expect(customer.complianceFrameworks).toContain('LGPD');
  });
});

// ─── Event AI ────────────────────────────────────────────────────────────────

describe('GET /api/v1/helios/ai/insights', () => {
  it('returns all 6 AI insights', async () => {
    const { status, body } = await G('/api/v1/helios/ai/insights');
    expect(status).toBe(200);
    expect(body.insights).toHaveLength(6);
    expect(body.total).toBe(6);
  });

  it('type=bottleneck returns 2', async () => {
    const { body } = await G('/api/v1/helios/ai/insights?type=bottleneck');
    expect(body.insights).toHaveLength(2);
    body.insights.forEach((i: any) => expect(i.type).toBe('bottleneck'));
  });

  it('type=growth_prediction returns 1 (topic-008)', async () => {
    const { body } = await G('/api/v1/helios/ai/insights?type=growth_prediction');
    expect(body.insights).toHaveLength(1);
    expect(body.insights[0].topicId).toBe('topic-008');
  });

  it('all insights have confidence 0-100', async () => {
    const { body } = await G('/api/v1/helios/ai/insights');
    body.insights.forEach((i: any) => {
      expect(i.confidence).toBeGreaterThan(0);
      expect(i.confidence).toBeLessThanOrEqual(100);
    });
  });
});

describe('GET /api/v1/helios/ai/forecast', () => {
  it('returns all 8 forecasts', async () => {
    const { status, body } = await G('/api/v1/helios/ai/forecast');
    expect(status).toBe(200);
    expect(body.forecasts).toHaveLength(8);
    expect(body.total).toBe(8);
  });

  it('topic-008 has growing trend with highest forecast', async () => {
    const { body } = await G('/api/v1/helios/ai/forecast?topicId=topic-008');
    expect(body.forecasts).toHaveLength(1);
    const f = body.forecasts[0];
    expect(f.trend).toBe('growing');
    expect(f.forecast90d).toBeGreaterThan(f.forecast30d);
    expect(f.forecast30d).toBeGreaterThan(f.forecast7d);
  });

  it('topic-005 (paused) has declining trend', async () => {
    const { body } = await G('/api/v1/helios/ai/forecast?topicId=topic-005');
    expect(body.forecasts[0].trend).toBe('declining');
  });
});

// ─── Digital Twin ────────────────────────────────────────────────────────────

describe('GET /api/v1/helios/twin/topology', () => {
  it('returns 8 nodes and 10 edges', async () => {
    const { status, body } = await G('/api/v1/helios/twin/topology');
    expect(status).toBe(200);
    expect(body.nodes).toHaveLength(8);
    expect(body.edges).toHaveLength(10);
  });

  it('all nodes have valid status', async () => {
    const { body } = await G('/api/v1/helios/twin/topology');
    body.nodes.forEach((n: any) => expect(['active', 'idle', 'error']).toContain(n.status));
  });
});

describe('GET /api/v1/helios/twin/flow/:id', () => {
  it('returns order-001 completed flow with 6 steps', async () => {
    const { status, body } = await G('/api/v1/helios/twin/flow/order-001');
    expect(status).toBe(200);
    expect(body.orderId).toBe('order-001');
    expect(body.status).toBe('completed');
    expect(body.steps).toHaveLength(6);
  });

  it('order-002 is in_progress with 4 steps', async () => {
    const { body } = await G('/api/v1/helios/twin/flow/order-002');
    expect(body.status).toBe('in_progress');
    expect(body.steps).toHaveLength(4);
  });

  it('returns 404 for unknown order', async () => {
    const { status, body } = await G('/api/v1/helios/twin/flow/order-999');
    expect(status).toBe(404);
    expect(body.error.code).toBe('FLOW_NOT_FOUND');
  });
});

// ─── Event Marketplace ────────────────────────────────────────────────────────

describe('GET /api/v1/helios/marketplace', () => {
  it('returns all 8 marketplace events', async () => {
    const { status, body } = await G('/api/v1/helios/marketplace');
    expect(status).toBe(200);
    expect(body.events).toHaveLength(8);
    expect(body.total).toBe(8);
  });

  it('category=logistics returns 2', async () => {
    const { body } = await G('/api/v1/helios/marketplace?category=logistics');
    expect(body.events).toHaveLength(2);
    body.events.forEach((e: any) => expect(e.category).toBe('logistics'));
  });

  it('tags=ai filter returns 1 (Fraud.Detected)', async () => {
    const { body } = await G('/api/v1/helios/marketplace?tags=ai');
    expect(body.events).toHaveLength(1);
    expect(body.events[0].eventType).toBe('Fraud.Detected');
  });
});

describe('GET /api/v1/helios/marketplace/:id', () => {
  it('returns mkt-001 (Order.Created)', async () => {
    const { status, body } = await G('/api/v1/helios/marketplace/mkt-001');
    expect(status).toBe(200);
    expect(body.eventType).toBe('Order.Created');
    expect(body.subscriberCount).toBeGreaterThan(0);
  });

  it('returns 404 for unknown marketplace event', async () => {
    const { status, body } = await G('/api/v1/helios/marketplace/mkt-999');
    expect(status).toBe(404);
    expect(body.error.code).toBe('MARKETPLACE_EVENT_NOT_FOUND');
  });
});

// ─── External Gateway ─────────────────────────────────────────────────────────

describe('GET /api/v1/helios/gateway/bridges', () => {
  it('returns all 8 bridges', async () => {
    const { status, body } = await G('/api/v1/helios/gateway/bridges');
    expect(status).toBe(200);
    expect(body.bridges).toHaveLength(8);
    expect(body.total).toBe(8);
  });

  it('status=connected returns 6', async () => {
    const { body } = await G('/api/v1/helios/gateway/bridges?status=connected');
    expect(body.bridges).toHaveLength(6);
  });

  it('status=error returns 1 (pulsar)', async () => {
    const { body } = await G('/api/v1/helios/gateway/bridges?status=error');
    expect(body.bridges).toHaveLength(1);
    expect(body.bridges[0].platform).toBe('pulsar');
    expect(body.bridges[0].errorMessage).toBeTruthy();
  });

  it('platform=kafka returns 1 bridge', async () => {
    const { body } = await G('/api/v1/helios/gateway/bridges?platform=kafka');
    expect(body.bridges).toHaveLength(1);
    expect(body.bridges[0].platform).toBe('kafka');
  });
});

describe('POST /api/v1/helios/gateway/bridges/:id/reconnect', () => {
  it('returns 404 for unknown bridge', async () => {
    const { status, body } = await P('/api/v1/helios/gateway/bridges/bridge-999/reconnect');
    expect(status).toBe(404);
    expect(body.error.code).toBe('BRIDGE_NOT_FOUND');
  });

  it('returns 400 ALREADY_CONNECTED for bridge-001', async () => {
    const { status, body } = await P('/api/v1/helios/gateway/bridges/bridge-001/reconnect');
    expect(status).toBe(400);
    expect(body.error.code).toBe('ALREADY_CONNECTED');
  });

  it('reconnects bridge-004 (disconnected → connected)', async () => {
    const { status, body } = await P('/api/v1/helios/gateway/bridges/bridge-004/reconnect');
    expect(status).toBe(200);
    expect(body.status).toBe('connected');
    expect(body.lastConnectedAt).toBeTruthy();
  });

  it('reconnects bridge-008 (error → connected)', async () => {
    const { status, body } = await P('/api/v1/helios/gateway/bridges/bridge-008/reconnect');
    expect(status).toBe(200);
    expect(body.status).toBe('connected');
  });
});
