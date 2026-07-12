import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, get, post } from './helpers.js';
import type { TestServer } from './helpers.js';

let srv: TestServer;
let base: string;

beforeAll(async () => {
  srv = await startTestServer();
  base = srv.baseUrl;
});

afterAll(() => srv.close());

// ─── GET /api/v1/governance/policies ─────────────────────────────────────────

describe('GET /api/v1/governance/policies', () => {
  it('returns 200 with all 8 seeded policies', async () => {
    const { status, body } = await get<any>(base, '/api/v1/governance/policies');
    expect(status).toBe(200);
    expect(body.total).toBe(8);
    expect(Array.isArray(body.policies)).toBe(true);
  });

  it('filters by enabled=true returns only enabled policies', async () => {
    const { status, body } = await get<any>(base, '/api/v1/governance/policies?enabled=true');
    expect(status).toBe(200);
    expect(body.policies.every((p: any) => p.enabled === true)).toBe(true);
    expect(body.total).toBe(7);
  });

  it('filters by category=security returns 3 policies', async () => {
    const { status, body } = await get<any>(base, '/api/v1/governance/policies?category=security');
    expect(status).toBe(200);
    expect(body.policies.every((p: any) => p.category === 'security')).toBe(true);
    expect(body.total).toBe(3);
  });

  it('returns 400 for invalid category', async () => {
    const { status, body } = await get<any>(base, '/api/v1/governance/policies?category=invalid');
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_CATEGORY');
  });
});

// ─── POST /api/v1/governance/policies ────────────────────────────────────────

describe('POST /api/v1/governance/policies', () => {
  it('creates a new policy and returns 201', async () => {
    const { status, body } = await post<any>(base, '/api/v1/governance/policies', {
      name: 'Country Block Policy',
      category: 'access',
      description: 'Block access from sanctioned countries',
      enforcement: 'mandatory',
      rules: { blockedCountries: ['KP', 'IR'] },
    });
    expect(status).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.name).toBe('Country Block Policy');
    expect(body.enabled).toBe(true);
    expect(body.version).toBe(1);
  });

  it('returns 400 when name is missing', async () => {
    const { status, body } = await post<any>(base, '/api/v1/governance/policies', {
      category: 'security',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 400 when category is missing', async () => {
    const { status, body } = await post<any>(base, '/api/v1/governance/policies', {
      name: 'Test Policy',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 400 for invalid enforcement value', async () => {
    const { status, body } = await post<any>(base, '/api/v1/governance/policies', {
      name: 'Bad Policy',
      category: 'security',
      enforcement: 'strict', // invalid
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_ENFORCEMENT');
  });
});

// ─── GET /api/v1/audit/logs ───────────────────────────────────────────────────

describe('GET /api/v1/audit/logs', () => {
  it('returns 200 with all 15 seeded logs', async () => {
    const { status, body } = await get<any>(base, '/api/v1/audit/logs');
    expect(status).toBe(200);
    expect(body.total).toBe(15);
    expect(Array.isArray(body.logs)).toBe(true);
  });

  it('each audit log has a sha256 signature', async () => {
    const { body } = await get<any>(base, '/api/v1/audit/logs');
    for (const log of body.logs) {
      expect(typeof log.signature).toBe('string');
      expect(log.signature.startsWith('sha256:')).toBe(true);
    }
  });

  it('filters by action=policy.updated', async () => {
    const { status, body } = await get<any>(base, '/api/v1/audit/logs?action=policy.updated');
    expect(status).toBe(200);
    expect(body.logs.every((l: any) => l.action === 'policy.updated')).toBe(true);
    expect(body.total).toBe(1);
  });

  it('limit parameter restricts result count', async () => {
    const { status, body } = await get<any>(base, '/api/v1/audit/logs?limit=5');
    expect(status).toBe(200);
    expect(body.logs).toHaveLength(5);
  });
});

// ─── GET /api/v1/audit/export ─────────────────────────────────────────────────

describe('GET /api/v1/audit/export', () => {
  it('exports as JSON with records array', async () => {
    const { status, body } = await get<any>(base, '/api/v1/audit/export?format=json');
    expect(status).toBe(200);
    expect(body.format).toBe('json');
    expect(Array.isArray(body.records)).toBe(true);
    expect(body.total).toBeGreaterThan(0);
  });

  it('exports as CSV with comma-delimited data string', async () => {
    const { status, body } = await get<any>(base, '/api/v1/audit/export?format=csv');
    expect(status).toBe(200);
    expect(body.format).toBe('csv');
    expect(typeof body.data).toBe('string');
    expect(body.data).toContain(',');
    expect(body.data).toContain('id');
  });

  it('exports as PDF with downloadUrl', async () => {
    const { status, body } = await get<any>(base, '/api/v1/audit/export?format=pdf');
    expect(status).toBe(200);
    expect(body.format).toBe('pdf');
    expect(typeof body.downloadUrl).toBe('string');
    expect(body.downloadUrl).toContain('/api/v1/audit/download/');
  });
});

// ─── GET /api/v1/compliance/status ───────────────────────────────────────────

describe('GET /api/v1/compliance/status', () => {
  it('returns all 6 compliance frameworks', async () => {
    const { status, body } = await get<any>(base, '/api/v1/compliance/status');
    expect(status).toBe(200);
    expect(Array.isArray(body.frameworks)).toBe(true);
    expect(body.frameworks).toHaveLength(6);
  });

  it('each framework has complianceScore', async () => {
    const { body } = await get<any>(base, '/api/v1/compliance/status');
    for (const fw of body.frameworks) {
      expect(typeof fw.complianceScore).toBe('number');
      expect(fw.complianceScore).toBeGreaterThanOrEqual(0);
      expect(fw.complianceScore).toBeLessThanOrEqual(100);
    }
  });

  it('each framework includes totalControls count', async () => {
    const { body } = await get<any>(base, '/api/v1/compliance/status');
    for (const fw of body.frameworks) {
      expect(typeof fw.totalControls).toBe('number');
      expect(fw.totalControls).toBe(4);
    }
  });

  it('overallScore is a number between 0 and 100', async () => {
    const { body } = await get<any>(base, '/api/v1/compliance/status');
    expect(typeof body.overallScore).toBe('number');
    expect(body.overallScore).toBeGreaterThan(0);
    expect(body.overallScore).toBeLessThanOrEqual(100);
  });
});

// ─── GET /api/v1/compliance/evidence ─────────────────────────────────────────

describe('GET /api/v1/compliance/evidence', () => {
  it('returns all 10 seeded evidence records', async () => {
    const { status, body } = await get<any>(base, '/api/v1/compliance/evidence');
    expect(status).toBe(200);
    expect(body.total).toBe(10);
    expect(Array.isArray(body.evidence)).toBe(true);
  });

  it('filters by framework=iso27001 returns 4 records', async () => {
    const { status, body } = await get<any>(base, '/api/v1/compliance/evidence?framework=iso27001');
    expect(status).toBe(200);
    expect(body.evidence.every((e: any) => e.framework === 'iso27001')).toBe(true);
    expect(body.total).toBe(4);
  });

  it('filters by status=valid returns only valid evidence', async () => {
    const { status, body } = await get<any>(base, '/api/v1/compliance/evidence?status=valid');
    expect(status).toBe(200);
    expect(body.evidence.every((e: any) => e.status === 'valid')).toBe(true);
    expect(body.total).toBe(8);
  });
});

// ─── GET /api/v1/risk ─────────────────────────────────────────────────────────

describe('GET /api/v1/risk', () => {
  it('returns all 8 seeded risks', async () => {
    const { status, body } = await get<any>(base, '/api/v1/risk');
    expect(status).toBe(200);
    expect(body.total).toBe(8);
    expect(Array.isArray(body.risks)).toBe(true);
  });

  it('filters by category=security', async () => {
    const { status, body } = await get<any>(base, '/api/v1/risk?category=security');
    expect(status).toBe(200);
    expect(body.risks.every((r: any) => r.category === 'security')).toBe(true);
    expect(body.total).toBe(3);
  });

  it('filters by severity=critical', async () => {
    const { status, body } = await get<any>(base, '/api/v1/risk?severity=critical');
    expect(status).toBe(200);
    expect(body.risks.every((r: any) => r.severity === 'critical')).toBe(true);
    expect(body.total).toBe(4);
  });

  it('filters by status=open', async () => {
    const { status, body } = await get<any>(base, '/api/v1/risk?status=open');
    expect(status).toBe(200);
    expect(body.risks.every((r: any) => r.status === 'open')).toBe(true);
    expect(body.total).toBe(2);
  });
});

// ─── POST /api/v1/risk ───────────────────────────────────────────────────────

describe('POST /api/v1/risk', () => {
  it('creates a risk and returns 201 with severity computed', async () => {
    const { status, body } = await post<any>(base, '/api/v1/risk', {
      title: 'Test Critical Risk',
      category: 'security',
      description: 'Unpatched CVE in auth library',
      probability: 5,
      impact: 5,
      owner: 'Dave Sec',
      mitigationPlan: 'Patch within 24h',
    });
    expect(status).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.severity).toBe('critical');
    expect(body.status).toBe('open');
  });

  it('returns 400 when title is missing', async () => {
    const { status, body } = await post<any>(base, '/api/v1/risk', {
      category: 'security',
      probability: 3,
      impact: 3,
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('severity is computed correctly: prob=2, impact=2 → medium (score=4)', async () => {
    const { body } = await post<any>(base, '/api/v1/risk', {
      title: 'Low-medium risk',
      category: 'operational',
      probability: 2,
      impact: 2,
    });
    expect(body.severity).toBe('medium');
  });
});

// ─── GET /api/v1/changes ─────────────────────────────────────────────────────

describe('GET /api/v1/changes', () => {
  it('returns all 6 seeded change requests', async () => {
    const { status, body } = await get<any>(base, '/api/v1/changes');
    expect(status).toBe(200);
    expect(body.total).toBe(6);
    expect(Array.isArray(body.changes)).toBe(true);
  });

  it('filters by status=pending returns only pending changes', async () => {
    const { status, body } = await get<any>(base, '/api/v1/changes?status=pending');
    expect(status).toBe(200);
    expect(body.changes.every((c: any) => c.status === 'pending')).toBe(true);
    expect(body.total).toBe(1);
  });

  it('filters by type=emergency', async () => {
    const { status, body } = await get<any>(base, '/api/v1/changes?type=emergency');
    expect(status).toBe(200);
    expect(body.changes.every((c: any) => c.type === 'emergency')).toBe(true);
    expect(body.total).toBe(1);
  });

  it('filters by priority=critical returns 1 change', async () => {
    const { status, body } = await get<any>(base, '/api/v1/changes?priority=critical');
    expect(status).toBe(200);
    expect(body.changes.every((c: any) => c.priority === 'critical')).toBe(true);
    expect(body.total).toBe(1);
  });
});

// ─── POST /api/v1/changes ────────────────────────────────────────────────────

describe('POST /api/v1/changes', () => {
  it('creates a change request and returns 201 with status=pending', async () => {
    const { status, body } = await post<any>(base, '/api/v1/changes', {
      title: 'Upgrade Node.js to v22',
      type: 'configuration',
      priority: 'medium',
      requesterName: 'Carol Dev',
      justification: 'Node 20 reaches EOL in April 2026',
      scheduledAt: '2026-02-01T08:00:00Z',
      affectedSystems: ['api-server', 'agent-runtime'],
    });
    expect(status).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.status).toBe('pending');
    expect(body.title).toBe('Upgrade Node.js to v22');
  });

  it('returns 400 when title is missing', async () => {
    const { status, body } = await post<any>(base, '/api/v1/changes', {
      type: 'configuration',
      justification: 'test',
      scheduledAt: '2026-01-01T00:00:00Z',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 400 when justification is missing', async () => {
    const { status, body } = await post<any>(base, '/api/v1/changes', {
      title: 'Test Change',
      type: 'configuration',
      scheduledAt: '2026-01-01T00:00:00Z',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });
});

// ─── POST /api/v1/changes/:id/approve ────────────────────────────────────────

describe('POST /api/v1/changes/:id/approve', () => {
  it('approves a pending change and returns status=approved', async () => {
    const { status, body } = await post<any>(base, '/api/v1/changes/chg-003/approve', {
      approverName: 'Alice Admin',
      notes: 'Firewall change reviewed — low risk',
    });
    expect(status).toBe(200);
    expect(body.status).toBe('approved');
    expect(body.approverName).toBe('Alice Admin');
    expect(body.approvalNotes).toBe('Firewall change reviewed — low risk');
  });

  it('returns 404 for unknown change ID', async () => {
    const { status, body } = await post<any>(base, '/api/v1/changes/chg-999/approve', {
      approverName: 'Alice Admin',
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 when change is not pending (already completed)', async () => {
    const { status, body } = await post<any>(base, '/api/v1/changes/chg-001/approve', {
      approverName: 'Alice Admin',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_STATUS');
  });
});

// ─── POST /api/v1/changes/:id/reject ─────────────────────────────────────────

describe('POST /api/v1/changes/:id/reject', () => {
  it('rejects a change and returns status=rejected', async () => {
    const { status, body } = await post<any>(base, '/api/v1/changes/chg-005/reject', {
      rejectorName: 'Alice Admin',
      reason: 'Cluster scale-out not budgeted for Q1',
    });
    expect(status).toBe(200);
    expect(body.status).toBe('rejected');
    expect(body.rejectionReason).toBe('Cluster scale-out not budgeted for Q1');
  });

  it('returns 404 for unknown change ID', async () => {
    const { status, body } = await post<any>(base, '/api/v1/changes/chg-000/reject', {
      reason: 'Testing',
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 when reason is missing', async () => {
    const { status, body } = await post<any>(base, '/api/v1/changes/chg-004/reject', {
      rejectorName: 'Alice Admin',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });
});
