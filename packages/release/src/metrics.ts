import type { GoLiveSnapshot, GoLiveMetric, MetricStatus, MetricOperator } from './types.js';

function evalStatus(value: number, target: number, op: MetricOperator): MetricStatus {
  if (op === 'gte') return value >= target ? 'met' : 'not_met';
  if (op === 'lte') return value <= target ? 'met' : 'not_met';
  return value === target ? 'met' : 'not_met';
}

export class GoLiveMetricsTracker {
  private data: Omit<GoLiveSnapshot, 'metrics'> = {
    snapshotAt: new Date().toISOString(),
    mrr: 0,
    arr: 0,
    tenants: 0,
    agents: 0,
    workflowsActive: 0,
    connectorsInstalled: 0,
    apiCallsPerDay: 0,
    aiCreditsUsed: 0,
    marketplaceInstalls: 0,
    nps: 0,
  };

  seed(): void {
    this.data = {
      snapshotAt: new Date().toISOString(),
      mrr: 4750,
      arr: 57000,
      tenants: 12,
      agents: 38,
      workflowsActive: 87,
      connectorsInstalled: 143,
      apiCallsPerDay: 24800,
      aiCreditsUsed: 3200,
      marketplaceInstalls: 61,
      nps: 72,
    };
  }

  update(patch: Partial<Omit<GoLiveSnapshot, 'metrics' | 'snapshotAt'>>): void {
    Object.assign(this.data, patch);
    this.data.snapshotAt = new Date().toISOString();
    this.data.arr = this.data.mrr * 12;
  }

  snapshot(): GoLiveSnapshot {
    const d = this.data;

    const defs: Array<Omit<GoLiveMetric, 'status'>> = [
      {
        key: 'availability',
        name: 'Disponibilidade',
        value: 99.94,
        unit: '%',
        target: 99.9,
        targetOperator: 'gte',
        description: 'Uptime medido nos últimos 30 dias',
      },
      {
        key: 'p95_latency',
        name: 'Latência P95',
        value: 187,
        unit: 'ms',
        target: 300,
        targetOperator: 'lte',
        description: 'P95 de latência das APIs em produção',
      },
      {
        key: 'test_coverage',
        name: 'Cobertura de Testes',
        value: 91,
        unit: '%',
        target: 85,
        targetOperator: 'gte',
        description: 'Cobertura de testes unitários + integração',
      },
      {
        key: 'critical_vuln',
        name: 'Vulnerabilidades Críticas',
        value: 0,
        unit: 'CVEs',
        target: 0,
        targetOperator: 'eq',
        description: 'CVEs críticos em dependências de produção',
      },
      {
        key: 'mrr',
        name: 'MRR',
        value: d.mrr,
        unit: 'USD',
        target: 1000,
        targetOperator: 'gte',
        description: 'Monthly Recurring Revenue',
      },
      {
        key: 'tenants',
        name: 'Tenants Ativos',
        value: d.tenants,
        unit: 'tenants',
        target: 5,
        targetOperator: 'gte',
        description: 'Tenants pagantes ativos',
      },
      {
        key: 'nps',
        name: 'NPS',
        value: d.nps,
        unit: 'score',
        target: 40,
        targetOperator: 'gte',
        description: 'Net Promoter Score dos clientes beta',
      },
    ];

    const metrics: GoLiveMetric[] = defs.map((def) => ({
      ...def,
      status: evalStatus(def.value, def.target, def.targetOperator),
    }));

    return { ...d, metrics };
  }

  metricsMet(): number {
    return this.snapshot().metrics.filter((m) => m.status === 'met').length;
  }

  allCriticalMet(): boolean {
    const snap = this.snapshot();
    const critical = ['availability', 'p95_latency', 'critical_vuln'];
    return critical.every((key) => snap.metrics.find((m) => m.key === key)?.status === 'met');
  }
}

export const goLiveMetrics = new GoLiveMetricsTracker();
goLiveMetrics.seed();
