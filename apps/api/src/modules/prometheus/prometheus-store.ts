import type {
  Trace,
  ServiceMap,
  ServiceNode,
  ServiceEdge,
  TelemetryOverview,
  ExecutiveDashboard,
  OperationsDashboard,
  AIDashboard,
  ConnectorMetric,
  Anomaly,
  Incident,
  IncidentTimelineEvent,
  RCAHypothesis,
  PredictiveAlert,
  AIRecommendation,
  SelfHealingRule,
  SLOTarget,
  CapacityPlan,
  CostReport,
  TenantCostBreakdown,
  WorkflowCost,
  Runbook,
  RunbookStep,
  CopilotResponse,
  DashboardType,
} from './types.js';

class PrometheusStore {
  private static instance: PrometheusStore;

  private traces: Trace[];
  private serviceMapData: ServiceMap;
  private anomalies: Anomaly[];
  private incidents: Incident[];
  private predictiveAlerts: PredictiveAlert[];
  private recommendations: AIRecommendation[];
  private selfHealingRules: SelfHealingRule[];
  private sloTargets: SLOTarget[];
  private capacityPlan: CapacityPlan;
  private costReport: CostReport;
  private runbooks: Runbook[];
  private execDashboard: ExecutiveDashboard;
  private opsDashboard: OperationsDashboard;
  private aiDashboard: AIDashboard;
  private connectorMetrics: ConnectorMetric[];

  private constructor() {
    this.traces = [
      {
        traceId: 'tr-001',
        rootService: 'gateway',
        operation: 'POST /api/integrations/sync',
        startedAt: '2026-07-11T09:00:00Z',
        totalDurationMs: 245,
        spanCount: 3,
        status: 'ok',
        tenantId: 'tenant-enterprise',
        spans: [
          {
            spanId: 'sp-001-1',
            service: 'gateway',
            operation: 'authenticate',
            startedAt: '2026-07-11T09:00:00Z',
            durationMs: 12,
            status: 'ok',
          },
          {
            spanId: 'sp-001-2',
            parentSpanId: 'sp-001-1',
            service: 'workflow',
            operation: 'execute',
            startedAt: '2026-07-11T09:00:00.012Z',
            durationMs: 210,
            status: 'ok',
          },
          {
            spanId: 'sp-001-3',
            parentSpanId: 'sp-001-2',
            service: 'connector',
            operation: 'sap.sync',
            startedAt: '2026-07-11T09:00:00.050Z',
            durationMs: 180,
            status: 'ok',
          },
        ],
      },
      {
        traceId: 'tr-002',
        rootService: 'gateway',
        operation: 'GET /api/agents/status',
        startedAt: '2026-07-11T09:01:00Z',
        totalDurationMs: 180,
        spanCount: 5,
        status: 'ok',
        tenantId: 'tenant-professional',
        spans: [
          {
            spanId: 'sp-002-1',
            service: 'gateway',
            operation: 'authenticate',
            startedAt: '2026-07-11T09:01:00Z',
            durationMs: 8,
            status: 'ok',
          },
          {
            spanId: 'sp-002-2',
            parentSpanId: 'sp-002-1',
            service: 'identity',
            operation: 'verify',
            startedAt: '2026-07-11T09:01:00.008Z',
            durationMs: 22,
            status: 'ok',
          },
          {
            spanId: 'sp-002-3',
            parentSpanId: 'sp-002-2',
            service: 'agent',
            operation: 'getStatus',
            startedAt: '2026-07-11T09:01:00.030Z',
            durationMs: 45,
            status: 'ok',
          },
          {
            spanId: 'sp-002-4',
            parentSpanId: 'sp-002-3',
            service: 'database',
            operation: 'query',
            startedAt: '2026-07-11T09:01:00.075Z',
            durationMs: 85,
            status: 'ok',
          },
          {
            spanId: 'sp-002-5',
            parentSpanId: 'sp-002-1',
            service: 'billing',
            operation: 'checkUsage',
            startedAt: '2026-07-11T09:01:00.008Z',
            durationMs: 20,
            status: 'ok',
          },
        ],
      },
      {
        traceId: 'tr-003',
        rootService: 'gateway',
        operation: 'POST /api/integrations/erp/sync',
        startedAt: '2026-07-11T09:32:00Z',
        totalDurationMs: 5200,
        spanCount: 4,
        status: 'error',
        tenantId: 'tenant-enterprise',
        spans: [
          {
            spanId: 'sp-003-1',
            service: 'gateway',
            operation: 'authenticate',
            startedAt: '2026-07-11T09:32:00Z',
            durationMs: 10,
            status: 'ok',
          },
          {
            spanId: 'sp-003-2',
            parentSpanId: 'sp-003-1',
            service: 'workflow',
            operation: 'execute',
            startedAt: '2026-07-11T09:32:00.010Z',
            durationMs: 5100,
            status: 'error',
          },
          {
            spanId: 'sp-003-3',
            parentSpanId: 'sp-003-2',
            service: 'connector',
            operation: 'sap.connect',
            startedAt: '2026-07-11T09:32:00.050Z',
            durationMs: 5000,
            status: 'timeout',
            tags: { error: 'VPN timeout after 5000ms' },
          },
          {
            spanId: 'sp-003-4',
            parentSpanId: 'sp-003-2',
            service: 'scheduler',
            operation: 'queueRetry',
            startedAt: '2026-07-11T09:32:05.050Z',
            durationMs: 50,
            status: 'ok',
          },
        ],
      },
      {
        traceId: 'tr-004',
        rootService: 'gateway',
        operation: 'GET /api/connectors/health',
        startedAt: '2026-07-11T09:05:00Z',
        totalDurationMs: 195,
        spanCount: 3,
        status: 'ok',
        tenantId: 'tenant-startup',
        spans: [
          {
            spanId: 'sp-004-1',
            service: 'gateway',
            operation: 'authenticate',
            startedAt: '2026-07-11T09:05:00Z',
            durationMs: 9,
            status: 'ok',
          },
          {
            spanId: 'sp-004-2',
            parentSpanId: 'sp-004-1',
            service: 'connector',
            operation: 'healthCheck',
            startedAt: '2026-07-11T09:05:00.009Z',
            durationMs: 155,
            status: 'ok',
          },
          {
            spanId: 'sp-004-3',
            parentSpanId: 'sp-004-2',
            service: 'database',
            operation: 'ping',
            startedAt: '2026-07-11T09:05:00.050Z',
            durationMs: 28,
            status: 'ok',
          },
        ],
      },
      {
        traceId: 'tr-005',
        rootService: 'workflow',
        operation: 'execute:sap-to-oracle-sync',
        startedAt: '2026-07-11T09:10:00Z',
        totalDurationMs: 340,
        spanCount: 6,
        status: 'ok',
        tenantId: 'tenant-enterprise',
        spans: [
          {
            spanId: 'sp-005-1',
            service: 'workflow',
            operation: 'start',
            startedAt: '2026-07-11T09:10:00Z',
            durationMs: 5,
            status: 'ok',
          },
          {
            spanId: 'sp-005-2',
            parentSpanId: 'sp-005-1',
            service: 'ai_engine',
            operation: 'mapFields',
            startedAt: '2026-07-11T09:10:00.005Z',
            durationMs: 120,
            status: 'ok',
          },
          {
            spanId: 'sp-005-3',
            parentSpanId: 'sp-005-1',
            service: 'connector',
            operation: 'sap.read',
            startedAt: '2026-07-11T09:10:00.005Z',
            durationMs: 180,
            status: 'ok',
          },
          {
            spanId: 'sp-005-4',
            parentSpanId: 'sp-005-3',
            service: 'connector',
            operation: 'oracle.write',
            startedAt: '2026-07-11T09:10:00.185Z',
            durationMs: 110,
            status: 'ok',
          },
          {
            spanId: 'sp-005-5',
            parentSpanId: 'sp-005-1',
            service: 'audit',
            operation: 'log',
            startedAt: '2026-07-11T09:10:00.295Z',
            durationMs: 20,
            status: 'ok',
          },
          {
            spanId: 'sp-005-6',
            parentSpanId: 'sp-005-1',
            service: 'billing',
            operation: 'trackUsage',
            startedAt: '2026-07-11T09:10:00.315Z',
            durationMs: 15,
            status: 'ok',
          },
        ],
      },
      {
        traceId: 'tr-006',
        rootService: 'workflow',
        operation: 'execute:oracle-payroll',
        startedAt: '2026-07-11T09:33:00Z',
        totalDurationMs: 8900,
        spanCount: 4,
        status: 'error',
        tenantId: 'tenant-professional',
        spans: [
          {
            spanId: 'sp-006-1',
            service: 'workflow',
            operation: 'start',
            startedAt: '2026-07-11T09:33:00Z',
            durationMs: 5,
            status: 'ok',
          },
          {
            spanId: 'sp-006-2',
            parentSpanId: 'sp-006-1',
            service: 'connector',
            operation: 'oracle.read',
            startedAt: '2026-07-11T09:33:00.005Z',
            durationMs: 8800,
            status: 'error',
            tags: { error: 'ORA-12170: Connect timeout' },
          },
          {
            spanId: 'sp-006-3',
            parentSpanId: 'sp-006-2',
            service: 'scheduler',
            operation: 'deadLetter',
            startedAt: '2026-07-11T09:33:08.805Z',
            durationMs: 55,
            status: 'ok',
          },
          {
            spanId: 'sp-006-4',
            parentSpanId: 'sp-006-1',
            service: 'audit',
            operation: 'logError',
            startedAt: '2026-07-11T09:33:08.860Z',
            durationMs: 30,
            status: 'ok',
          },
        ],
      },
      {
        traceId: 'tr-007',
        rootService: 'workflow',
        operation: 'execute:billing-sync',
        startedAt: '2026-07-11T09:15:00Z',
        totalDurationMs: 270,
        spanCount: 5,
        status: 'ok',
        tenantId: 'tenant-startup',
        spans: [
          {
            spanId: 'sp-007-1',
            service: 'workflow',
            operation: 'start',
            startedAt: '2026-07-11T09:15:00Z',
            durationMs: 5,
            status: 'ok',
          },
          {
            spanId: 'sp-007-2',
            parentSpanId: 'sp-007-1',
            service: 'billing',
            operation: 'reconcile',
            startedAt: '2026-07-11T09:15:00.005Z',
            durationMs: 200,
            status: 'ok',
          },
          {
            spanId: 'sp-007-3',
            parentSpanId: 'sp-007-2',
            service: 'database',
            operation: 'upsert',
            startedAt: '2026-07-11T09:15:00.080Z',
            durationMs: 120,
            status: 'ok',
          },
          {
            spanId: 'sp-007-4',
            parentSpanId: 'sp-007-1',
            service: 'ai_engine',
            operation: 'anomalyCheck',
            startedAt: '2026-07-11T09:15:00.205Z',
            durationMs: 40,
            status: 'ok',
          },
          {
            spanId: 'sp-007-5',
            parentSpanId: 'sp-007-1',
            service: 'audit',
            operation: 'log',
            startedAt: '2026-07-11T09:15:00.245Z',
            durationMs: 18,
            status: 'ok',
          },
        ],
      },
      {
        traceId: 'tr-008',
        rootService: 'connector',
        operation: 'protheus.inventory.read',
        startedAt: '2026-07-11T09:20:00Z',
        totalDurationMs: 430,
        spanCount: 3,
        status: 'ok',
        tenantId: 'tenant-enterprise',
        spans: [
          {
            spanId: 'sp-008-1',
            service: 'connector',
            operation: 'authenticate',
            startedAt: '2026-07-11T09:20:00Z',
            durationMs: 35,
            status: 'ok',
          },
          {
            spanId: 'sp-008-2',
            parentSpanId: 'sp-008-1',
            service: 'connector',
            operation: 'query',
            startedAt: '2026-07-11T09:20:00.035Z',
            durationMs: 370,
            status: 'ok',
          },
          {
            spanId: 'sp-008-3',
            parentSpanId: 'sp-008-2',
            service: 'database',
            operation: 'cache.set',
            startedAt: '2026-07-11T09:20:00.405Z',
            durationMs: 18,
            status: 'ok',
          },
        ],
      },
      {
        traceId: 'tr-009',
        rootService: 'connector',
        operation: 'sap.finance.read',
        startedAt: '2026-07-11T09:32:30Z',
        totalDurationMs: 5000,
        spanCount: 2,
        status: 'timeout',
        tenantId: 'tenant-enterprise',
        spans: [
          {
            spanId: 'sp-009-1',
            service: 'connector',
            operation: 'authenticate',
            startedAt: '2026-07-11T09:32:30Z',
            durationMs: 15,
            status: 'ok',
          },
          {
            spanId: 'sp-009-2',
            parentSpanId: 'sp-009-1',
            service: 'connector',
            operation: 'query',
            startedAt: '2026-07-11T09:32:30.015Z',
            durationMs: 4985,
            status: 'timeout',
            tags: { error: 'Remote host timeout' },
          },
        ],
      },
      {
        traceId: 'tr-010',
        rootService: 'ai_engine',
        operation: 'fieldMapping.infer',
        startedAt: '2026-07-11T09:25:00Z',
        totalDurationMs: 680,
        spanCount: 4,
        status: 'ok',
        tenantId: 'tenant-professional',
        spans: [
          {
            spanId: 'sp-010-1',
            service: 'ai_engine',
            operation: 'loadModel',
            startedAt: '2026-07-11T09:25:00Z',
            durationMs: 120,
            status: 'ok',
          },
          {
            spanId: 'sp-010-2',
            parentSpanId: 'sp-010-1',
            service: 'ai_engine',
            operation: 'tokenize',
            startedAt: '2026-07-11T09:25:00.120Z',
            durationMs: 200,
            status: 'ok',
          },
          {
            spanId: 'sp-010-3',
            parentSpanId: 'sp-010-2',
            service: 'ai_engine',
            operation: 'infer',
            startedAt: '2026-07-11T09:25:00.320Z',
            durationMs: 320,
            status: 'ok',
          },
          {
            spanId: 'sp-010-4',
            parentSpanId: 'sp-010-3',
            service: 'database',
            operation: 'cache.set',
            startedAt: '2026-07-11T09:25:00.640Z',
            durationMs: 22,
            status: 'ok',
          },
        ],
      },
    ];

    this.serviceMapData = {
      generatedAt: '2026-07-11T09:40:00Z',
      nodes: [
        {
          id: 'gateway',
          name: 'API Gateway',
          type: 'gateway',
          status: 'healthy',
          requestsPerMin: 1240,
          errorRate: 0.8,
          avgLatencyMs: 42,
        },
        {
          id: 'identity',
          name: 'Identity Service',
          type: 'service',
          status: 'healthy',
          requestsPerMin: 980,
          errorRate: 0.1,
          avgLatencyMs: 18,
        },
        {
          id: 'billing',
          name: 'Billing Service',
          type: 'service',
          status: 'healthy',
          requestsPerMin: 420,
          errorRate: 0.0,
          avgLatencyMs: 28,
        },
        {
          id: 'workflow',
          name: 'Workflow Engine',
          type: 'engine',
          status: 'degraded',
          requestsPerMin: 860,
          errorRate: 4.2,
          avgLatencyMs: 340,
        },
        {
          id: 'connector',
          name: 'Connector Hub',
          type: 'connector',
          status: 'healthy',
          requestsPerMin: 720,
          errorRate: 2.1,
          avgLatencyMs: 185,
        },
        {
          id: 'ai_engine',
          name: 'AI Engine',
          type: 'ai',
          status: 'healthy',
          requestsPerMin: 380,
          errorRate: 0.3,
          avgLatencyMs: 620,
        },
        {
          id: 'scheduler',
          name: 'Scheduler',
          type: 'scheduler',
          status: 'healthy',
          requestsPerMin: 540,
          errorRate: 0.5,
          avgLatencyMs: 22,
        },
        {
          id: 'database',
          name: 'Primary Database',
          type: 'database',
          status: 'degraded',
          requestsPerMin: 2100,
          errorRate: 0.2,
          avgLatencyMs: 95,
        },
      ] as ServiceNode[],
      edges: [
        { source: 'gateway', target: 'identity', requestsPerMin: 980, errorRate: 0.1 },
        { source: 'gateway', target: 'billing', requestsPerMin: 420, errorRate: 0.0 },
        { source: 'gateway', target: 'workflow', requestsPerMin: 860, errorRate: 4.2 },
        { source: 'workflow', target: 'connector', requestsPerMin: 720, errorRate: 2.1 },
        { source: 'workflow', target: 'ai_engine', requestsPerMin: 380, errorRate: 0.3 },
        { source: 'workflow', target: 'scheduler', requestsPerMin: 540, errorRate: 0.5 },
        { source: 'connector', target: 'database', requestsPerMin: 1200, errorRate: 0.4 },
        { source: 'ai_engine', target: 'database', requestsPerMin: 900, errorRate: 0.1 },
        { source: 'billing', target: 'database', requestsPerMin: 420, errorRate: 0.0 },
        { source: 'identity', target: 'database', requestsPerMin: 580, errorRate: 0.1 },
      ] as ServiceEdge[],
    };

    this.anomalies = [
      {
        id: 'anom-001',
        title: 'Request Rate Spike — API Gateway',
        description: 'Request rate exceeded 950 req/min, 8x above normal baseline.',
        severity: 'critical',
        status: 'active',
        probability: 98.7,
        source: 'gateway',
        metric: 'request_rate',
        normalValue: 120,
        detectedValue: 950,
        unit: 'req/min',
        detectedAt: '2026-07-11T09:32:00Z',
      },
      {
        id: 'anom-002',
        title: 'Memory Pressure — Worker-03',
        description:
          'Heap usage at 84% and growing steadily. Possible memory leak in connector pool.',
        severity: 'critical',
        status: 'investigating',
        probability: 94.2,
        source: 'worker-03',
        metric: 'heap_usage',
        normalValue: 55,
        detectedValue: 84,
        unit: '%',
        detectedAt: '2026-07-11T08:45:00Z',
      },
      {
        id: 'anom-003',
        title: 'Error Rate Spike — SAP Connector',
        description: 'SAP connector error rate jumped to 18.4%, exceeding 5% threshold.',
        severity: 'high',
        status: 'active',
        probability: 87.5,
        source: 'connector-sap',
        metric: 'error_rate',
        normalValue: 0.8,
        detectedValue: 18.4,
        unit: '%',
        detectedAt: '2026-07-11T09:33:00Z',
      },
      {
        id: 'anom-004',
        title: 'Latency Spike — Workflow Engine',
        description: 'P99 latency on workflow execution rose 320% from baseline.',
        severity: 'high',
        status: 'active',
        probability: 82.3,
        source: 'workflow',
        metric: 'p99_latency_ms',
        normalValue: 210,
        detectedValue: 882,
        unit: 'ms',
        detectedAt: '2026-07-11T09:34:00Z',
      },
      {
        id: 'anom-005',
        title: 'Disk Usage Growth — Database Primary',
        description: 'Database disk at 68% with accelerating growth pattern.',
        severity: 'medium',
        status: 'investigating',
        probability: 71.0,
        source: 'database-primary',
        metric: 'disk_usage',
        normalValue: 50,
        detectedValue: 68,
        unit: '%',
        detectedAt: '2026-07-11T08:00:00Z',
      },
      {
        id: 'anom-006',
        title: 'CPU Spike — Gateway Node 1',
        description: 'Transient CPU spike resolved after auto-scaling.',
        severity: 'low',
        status: 'resolved',
        probability: 65.0,
        source: 'gateway-node-1',
        metric: 'cpu_usage',
        normalValue: 45,
        detectedValue: 92,
        unit: '%',
        detectedAt: '2026-07-11T07:00:00Z',
        resolvedAt: '2026-07-11T07:08:00Z',
      },
    ];

    this.incidents = [
      {
        id: 'inc-001',
        title: 'SAP Connector VPN Timeout',
        severity: 'critical',
        status: 'open',
        affectedServices: ['connector', 'workflow', 'gateway'],
        detectedAt: '2026-07-11T09:32:00Z',
        timeline: [
          {
            timestamp: '2026-07-11T09:32:00Z',
            description: 'VPN latency increased to 450ms — 3x above normal',
            type: 'detection',
          },
          {
            timestamp: '2026-07-11T09:33:00Z',
            description: 'SAP connector timeouts started — 18% error rate',
            type: 'escalation',
          },
          {
            timestamp: '2026-07-11T09:34:00Z',
            description: 'Workflow queue depth reached 850 items',
            type: 'escalation',
          },
          {
            timestamp: '2026-07-11T09:35:00Z',
            description: 'Alert escalated to on-call engineering team',
            type: 'action',
          },
          {
            timestamp: '2026-07-11T09:36:00Z',
            description: 'SAP connection pool reset, retries initiated',
            type: 'action',
          },
          {
            timestamp: '2026-07-11T09:37:00Z',
            description: 'Investigating VPN route — awaiting network team response',
            type: 'action',
          },
        ] as IncidentTimelineEvent[],
        rca: [
          {
            component: 'VPN Tunnel (SAP Datacenter)',
            hypothesis:
              'VPN tunnel degradation causing packet loss and increased latency to SAP S/4HANA',
            confidence: 94,
            evidence: [
              '450ms VPN RTT (normal: 12ms)',
              '18.4% connector error rate',
              'Traces show 5s timeout on SAP spans',
            ],
          },
          {
            component: 'SAP Remote Database',
            hypothesis: 'SAP remote database slow due to maintenance window overlap',
            confidence: 78,
            evidence: [
              'P99 latency increased 320%',
              'Read operations timing out consistently',
              'Similar pattern last month during SAP update',
            ],
          },
          {
            component: 'Network Infrastructure',
            hypothesis: 'ISP-level BGP routing change causing suboptimal path',
            confidence: 62,
            evidence: [
              'Latency spike at 09:32 matches BGP announcement',
              'Other tenants unaffected',
              'Traceroute shows extra hop added',
            ],
          },
        ] as RCAHypothesis[],
      },
      {
        id: 'inc-002',
        title: 'Workflow Engine Elevated Latency',
        severity: 'high',
        status: 'investigating',
        affectedServices: ['workflow', 'connector'],
        detectedAt: '2026-07-11T09:34:00Z',
        timeline: [
          {
            timestamp: '2026-07-11T09:34:00Z',
            description: 'Workflow P99 latency crossed 800ms threshold',
            type: 'detection',
          },
          {
            timestamp: '2026-07-11T09:35:30Z',
            description: 'Alert triggered — 3 tenants impacted',
            type: 'escalation',
          },
          {
            timestamp: '2026-07-11T09:36:00Z',
            description: 'Investigation started, correlating with SAP incident',
            type: 'action',
          },
        ] as IncidentTimelineEvent[],
        rca: [
          {
            component: 'SAP Connector Dependency',
            hypothesis: 'Workflow latency caused by cascading delay from SAP connector timeout',
            confidence: 88,
            evidence: [
              'Timeline correlation within 2 minutes of SAP incident',
              'Only SAP-dependent workflows affected',
              'Queue backlog growing',
            ],
          },
          {
            component: 'Workflow DB Pool',
            hypothesis: 'Database connection pool exhaustion under high retry load',
            confidence: 55,
            evidence: [
              'DB connection count at 94% capacity',
              'Increased wait time for DB connections',
            ],
          },
        ] as RCAHypothesis[],
      },
      {
        id: 'inc-003',
        title: 'Memory Pressure on Worker-03',
        severity: 'high',
        status: 'investigating',
        affectedServices: ['workflow', 'scheduler'],
        detectedAt: '2026-07-11T08:45:00Z',
        timeline: [
          {
            timestamp: '2026-07-11T08:45:00Z',
            description: 'Heap usage crossed 80% on Worker-03',
            type: 'detection',
          },
          {
            timestamp: '2026-07-11T09:00:00Z',
            description: 'Heap reached 84% — memory leak pattern detected',
            type: 'escalation',
          },
          {
            timestamp: '2026-07-11T09:10:00Z',
            description: 'Self-healing rule triggered: scheduled restart during off-peak',
            type: 'action',
          },
        ] as IncidentTimelineEvent[],
        rca: [
          {
            component: 'Connector Pool Manager',
            hypothesis:
              'Connector pool objects not being garbage collected after failed connections',
            confidence: 82,
            evidence: [
              'Heap dump shows 12,000 uncollected ConnectionPool objects',
              'Growth started after connector version 2.3.1 deploy',
            ],
          },
        ] as RCAHypothesis[],
      },
      {
        id: 'inc-004',
        title: 'API Gateway Spike — Auto-Resolved',
        severity: 'medium',
        status: 'resolved',
        affectedServices: ['gateway'],
        detectedAt: '2026-07-11T07:00:00Z',
        resolvedAt: '2026-07-11T07:08:00Z',
        timeline: [
          {
            timestamp: '2026-07-11T07:00:00Z',
            description: 'CPU spike to 92% on Gateway Node 1',
            type: 'detection',
          },
          {
            timestamp: '2026-07-11T07:03:00Z',
            description: 'Auto-scaling triggered — new node provisioned',
            type: 'action',
          },
          {
            timestamp: '2026-07-11T07:08:00Z',
            description: 'Load balanced, CPU normalized to 48%',
            type: 'resolution',
          },
        ] as IncidentTimelineEvent[],
        rca: [
          {
            component: 'Auto-Scaling',
            hypothesis:
              'Traffic spike from batch job caused temporary CPU pressure, resolved by auto-scaling',
            confidence: 97,
            evidence: [
              'CPU returned to baseline after scale-out',
              'Batch job logs confirm burst at 07:00',
            ],
          },
        ] as RCAHypothesis[],
      },
    ];

    this.predictiveAlerts = [
      {
        id: 'pred-001',
        type: 'disk',
        resource: 'worker-01 /data',
        currentValue: 72,
        thresholdValue: 90,
        unit: '%',
        trendPerDay: 2.0,
        predictedFailureInDays: 9,
        confidence: 91,
        recommendation: 'Expand disk or archive old workflow logs to cold storage.',
        createdAt: '2026-07-11T08:00:00Z',
      },
      {
        id: 'pred-002',
        type: 'disk',
        resource: 'database-primary /var/lib/postgresql',
        currentValue: 68,
        thresholdValue: 85,
        unit: '%',
        trendPerDay: 1.5,
        predictedFailureInDays: 11,
        confidence: 87,
        recommendation: 'Enable tablespace autogrow or provision 500GB additional storage.',
        createdAt: '2026-07-11T08:00:00Z',
      },
      {
        id: 'pred-003',
        type: 'memory',
        resource: 'worker-03 heap',
        currentValue: 84,
        thresholdValue: 95,
        unit: '%',
        trendPerDay: 0.8,
        predictedFailureInDays: 14,
        confidence: 85,
        recommendation: 'Restart worker during off-peak. Investigate connector pool memory leak.',
        createdAt: '2026-07-11T08:45:00Z',
      },
      {
        id: 'pred-004',
        type: 'memory',
        resource: 'cache-cluster-01',
        currentValue: 76,
        thresholdValue: 90,
        unit: '%',
        trendPerDay: 1.2,
        predictedFailureInDays: 12,
        confidence: 79,
        recommendation: 'Increase cache eviction policy aggressiveness or add 8GB cache node.',
        createdAt: '2026-07-11T08:00:00Z',
      },
      {
        id: 'pred-005',
        type: 'cpu',
        resource: 'gateway-node-02',
        currentValue: 78,
        thresholdValue: 90,
        unit: '%',
        trendPerDay: 0.5,
        predictedFailureInDays: 24,
        confidence: 74,
        recommendation: 'Pre-provision additional gateway node before traffic peaks.',
        createdAt: '2026-07-11T08:00:00Z',
      },
    ];

    this.recommendations = [
      {
        id: 'rec-001',
        category: 'performance',
        title: 'Migrate Agent-07 to Node-3',
        description: 'Agent-07 is consuming 94% CPU on Node-1. Node-3 has 38% available capacity.',
        estimatedImpact: 'Reduce CPU usage by ~18% and improve workflow throughput',
        estimatedSavingPercent: 18,
        confidence: 93,
        status: 'pending',
        createdAt: '2026-07-11T09:00:00Z',
      },
      {
        id: 'rec-002',
        category: 'performance',
        title: 'Enable SAP Response Caching',
        description:
          'SAP master data queries repeat identical calls. Adding TTL cache would eliminate redundant ERP roundtrips.',
        estimatedImpact: 'Reduce SAP connector latency by 230ms average',
        estimatedSavingMs: 230,
        confidence: 88,
        status: 'pending',
        createdAt: '2026-07-11T09:00:00Z',
      },
      {
        id: 'rec-003',
        category: 'performance',
        title: 'Increase Connector Thread Pool',
        description: 'Connector pool size (10) is insufficient for current load. Increase to 25.',
        estimatedImpact: 'Reduce connector error rate by ~15% under peak load',
        estimatedSavingPercent: 15,
        confidence: 84,
        status: 'pending',
        createdAt: '2026-07-11T09:00:00Z',
      },
      {
        id: 'rec-004',
        category: 'cost',
        title: 'Consolidate Workers During Off-Peak',
        description:
          'Worker utilization drops below 20% between 01:00-06:00 UTC. Scale down to 4 workers.',
        estimatedImpact: 'Save ~R$ 280/month in idle compute costs',
        estimatedSavingPercent: 22,
        confidence: 91,
        status: 'pending',
        createdAt: '2026-07-11T09:00:00Z',
      },
      {
        id: 'rec-005',
        category: 'cost',
        title: 'Use Spot Instances for Batch Jobs',
        description:
          'Nightly batch synchronizations can tolerate interruptions. Switch to spot/preemptible instances.',
        estimatedImpact: 'Save ~R$ 480/month on batch compute — 65% cost reduction',
        estimatedSavingPercent: 65,
        confidence: 78,
        status: 'pending',
        createdAt: '2026-07-11T09:00:00Z',
      },
      {
        id: 'rec-006',
        category: 'reliability',
        title: 'Enable Auto-Restart for Connector Services',
        description:
          'Added process supervisor with health check restart for all connector processes.',
        estimatedImpact: 'Reduced connector downtime from 12 min to <30 seconds',
        confidence: 99,
        status: 'applied',
        createdAt: '2026-07-10T10:00:00Z',
        appliedAt: '2026-07-10T14:00:00Z',
      },
      {
        id: 'rec-007',
        category: 'scaling',
        title: 'Pre-Provision 2 Nodes for Q4 Traffic',
        description:
          'Historical Q4 data shows 3x traffic spike. Pre-provisioning reduces cold-start risk.',
        estimatedImpact: 'Prevent potential SLA breach during Q4 peak',
        confidence: 82,
        status: 'dismissed',
        createdAt: '2026-07-05T10:00:00Z',
      },
    ];

    this.selfHealingRules = [
      {
        id: 'heal-001',
        name: 'Agent Auto-Restart',
        trigger: 'agent_down',
        action: 'restart_service',
        enabled: true,
        executionCount: 12,
        successRate: 100,
        lastTriggeredAt: '2026-07-10T14:32:00Z',
        description:
          'Automatically restart any agent process that fails health check 3 times in 60 seconds.',
      },
      {
        id: 'heal-002',
        name: 'Memory Leak Worker Restart',
        trigger: 'memory_leak',
        action: 'restart_service',
        enabled: true,
        executionCount: 5,
        successRate: 80,
        lastTriggeredAt: '2026-07-11T09:10:00Z',
        description: 'Restart worker when heap usage exceeds 90% for more than 5 minutes.',
      },
      {
        id: 'heal-003',
        name: 'Connector Failover',
        trigger: 'connector_timeout',
        action: 'failover',
        enabled: true,
        executionCount: 8,
        successRate: 87.5,
        lastTriggeredAt: '2026-07-11T09:36:00Z',
        description:
          'Route connector traffic to backup endpoint when primary times out 5 times in 2 minutes.',
      },
      {
        id: 'heal-004',
        name: 'Worker Auto-Scale',
        trigger: 'worker_overload',
        action: 'scale_up',
        enabled: false,
        executionCount: 0,
        successRate: 0,
        description:
          'Spin up additional worker node when queue depth exceeds 1000 items. Requires manual approval.',
      },
      {
        id: 'heal-005',
        name: 'Cache Clear on Error Spike',
        trigger: 'high_error_rate',
        action: 'clear_cache',
        enabled: false,
        executionCount: 3,
        successRate: 66.7,
        lastTriggeredAt: '2026-07-08T15:00:00Z',
        description:
          'Clear application cache when error rate exceeds 10% for 3 consecutive minutes.',
      },
    ];

    const MONTHLY_MINUTES = 43_200;
    this.sloTargets = [
      {
        id: 'slo-001',
        tenantId: 'tenant-enterprise',
        tenantName: 'Acme Corp (Enterprise)',
        targetUptime: 99.99,
        currentUptime: 99.98,
        errorBudgetMinutes: Math.round(MONTHLY_MINUTES * 0.0001 * 10) / 10, // 4.3 min
        errorBudgetUsed: 0.9,
        status: 'healthy',
        period: '2026-07',
        incidentsThisMonth: 1,
      },
      {
        id: 'slo-002',
        tenantId: 'tenant-professional',
        tenantName: 'TechVentures (Professional)',
        targetUptime: 99.95,
        currentUptime: 99.93,
        errorBudgetMinutes: Math.round(MONTHLY_MINUTES * 0.0005 * 10) / 10, // 21.6 min
        errorBudgetUsed: 15.1,
        status: 'at_risk',
        period: '2026-07',
        incidentsThisMonth: 2,
      },
      {
        id: 'slo-003',
        tenantId: 'tenant-startup',
        tenantName: 'StartupXYZ (Startup)',
        targetUptime: 99.9,
        currentUptime: 99.92,
        errorBudgetMinutes: Math.round(MONTHLY_MINUTES * 0.001 * 10) / 10, // 43.2 min
        errorBudgetUsed: 6.5,
        status: 'healthy',
        period: '2026-07',
        incidentsThisMonth: 0,
      },
      {
        id: 'slo-004',
        tenantId: 'tenant-developer',
        tenantName: 'DevLabs (Developer)',
        targetUptime: 99.9,
        currentUptime: 99.85,
        errorBudgetMinutes: Math.round(MONTHLY_MINUTES * 0.001 * 10) / 10,
        errorBudgetUsed: 64.8,
        status: 'breached',
        period: '2026-07',
        incidentsThisMonth: 4,
      },
    ];

    this.capacityPlan = {
      generatedAt: '2026-07-11T09:00:00Z',
      currentClients: 200,
      forecastedClients6m: 420,
      forecastedClients12m: 640,
      forecasts: [
        {
          resource: 'Workers',
          currentValue: 12,
          unit: 'nodes',
          forecast6Months: 26,
          forecast12Months: 38,
          recommendedAddition: '+14 workers',
          urgency: 'high',
        },
        {
          resource: 'Compute Nodes',
          currentValue: 4,
          unit: 'nodes',
          forecast6Months: 8,
          forecast12Months: 12,
          recommendedAddition: '+4 nodes',
          urgency: 'high',
        },
        {
          resource: 'Storage',
          currentValue: 4.2,
          unit: 'TB',
          forecast6Months: 8.8,
          forecast12Months: 13.5,
          recommendedAddition: '+4.6 TB',
          urgency: 'medium',
        },
        {
          resource: 'CPU Cores',
          currentValue: 64,
          unit: 'vCPU',
          forecast6Months: 128,
          forecast12Months: 192,
          recommendedAddition: '+64 vCPU',
          urgency: 'medium',
        },
        {
          resource: 'Memory',
          currentValue: 256,
          unit: 'GB',
          forecast6Months: 512,
          forecast12Months: 768,
          recommendedAddition: '+256 GB',
          urgency: 'low',
        },
      ],
    };

    const PERIOD = '2026-07';
    const tenants: TenantCostBreakdown[] = [
      {
        tenantId: 'tenant-enterprise',
        tenantName: 'Acme Corp',
        period: PERIOD,
        apiCost: 420,
        aiCost: 180,
        storageCost: 40,
        networkCost: 15,
        workerCost: 85,
        totalCost: 740,
      },
      {
        tenantId: 'tenant-professional',
        tenantName: 'TechVentures',
        period: PERIOD,
        apiCost: 210,
        aiCost: 95,
        storageCost: 25,
        networkCost: 8,
        workerCost: 42,
        totalCost: 380,
      },
      {
        tenantId: 'tenant-startup',
        tenantName: 'StartupXYZ',
        period: PERIOD,
        apiCost: 85,
        aiCost: 30,
        storageCost: 12,
        networkCost: 3,
        workerCost: 18,
        totalCost: 148,
      },
      {
        tenantId: 'tenant-developer',
        tenantName: 'DevLabs',
        period: PERIOD,
        apiCost: 32,
        aiCost: 8,
        storageCost: 6,
        networkCost: 2,
        workerCost: 10,
        totalCost: 58,
      },
    ];
    const totalPlatformCost = tenants.reduce((s, t) => s + t.totalCost, 0);
    const totalRevenue = 2_450;
    this.costReport = {
      period: PERIOD,
      tenants,
      topWorkflows: [
        {
          workflowId: 'wf-sap-sync',
          workflowName: 'SAP S/4HANA Full Sync',
          executionCount: 4_320,
          totalCost: 185,
          avgCostPerExecution: 0.043,
        },
        {
          workflowId: 'wf-oracle-payroll',
          workflowName: 'Oracle Payroll Export',
          executionCount: 720,
          totalCost: 142,
          avgCostPerExecution: 0.197,
        },
        {
          workflowId: 'wf-protheus-inv',
          workflowName: 'Protheus Inventory Sync',
          executionCount: 8_640,
          totalCost: 98,
          avgCostPerExecution: 0.011,
        },
        {
          workflowId: 'wf-ai-mapping',
          workflowName: 'AI Field Mapping',
          executionCount: 12_500,
          totalCost: 280,
          avgCostPerExecution: 0.022,
        },
      ],
      totalPlatformCost,
      totalRevenue,
      margin: Math.round(((totalRevenue - totalPlatformCost) / totalRevenue) * 1000) / 10,
      generatedAt: '2026-07-11T09:00:00Z',
    };

    this.runbooks = [
      {
        id: 'rb-001',
        title: 'Oracle ERP Connection Error',
        trigger: 'oracle_connection_error',
        mode: 'automatic',
        executionCount: 8,
        avgResolutionMinutes: 4,
        lastUsedAt: '2026-07-10T22:15:00Z',
        createdAt: '2026-01-15T00:00:00Z',
        steps: [
          {
            order: 1,
            title: 'Check VPN Status',
            description: 'Verify VPN tunnel to Oracle datacenter is active.',
            type: 'check',
            automated: true,
            estimatedDurationSeconds: 15,
          },
          {
            order: 2,
            title: 'Test Port 1521',
            description: 'Attempt TCP connection to Oracle listener on port 1521.',
            type: 'check',
            automated: true,
            estimatedDurationSeconds: 10,
          },
          {
            order: 3,
            title: 'Query Oracle Health',
            description: 'Run SELECT 1 FROM DUAL to verify DB responsiveness.',
            type: 'check',
            automated: true,
            estimatedDurationSeconds: 20,
          },
          {
            order: 4,
            title: 'Reconnect Pool',
            description: 'Force connector connection pool to reconnect.',
            type: 'action',
            automated: true,
            estimatedDurationSeconds: 30,
          },
          {
            order: 5,
            title: 'Verify Recovery',
            description: 'Run 3 test workflow executions and confirm success.',
            type: 'check',
            automated: true,
            estimatedDurationSeconds: 45,
          },
          {
            order: 6,
            title: 'Open Ticket if Failed',
            description: 'Create support ticket with Oracle DBA team if reconnect fails.',
            type: 'notify',
            automated: false,
            estimatedDurationSeconds: 120,
          },
        ] as RunbookStep[],
      },
      {
        id: 'rb-002',
        title: 'VPN Timeout Recovery',
        trigger: 'vpn_timeout',
        mode: 'assisted',
        executionCount: 3,
        avgResolutionMinutes: 12,
        lastUsedAt: '2026-07-11T09:36:00Z',
        createdAt: '2026-02-01T00:00:00Z',
        steps: [
          {
            order: 1,
            title: 'Identify Affected Tunnels',
            description: 'List VPN tunnels with elevated latency or packet loss.',
            type: 'check',
            automated: true,
            estimatedDurationSeconds: 30,
          },
          {
            order: 2,
            title: 'Renegotiate VPN',
            description: 'Trigger IKE renegotiation on affected tunnels.',
            type: 'action',
            automated: false,
            estimatedDurationSeconds: 120,
          },
          {
            order: 3,
            title: 'Switch to Backup Route',
            description: 'Update routing table to use secondary VPN endpoint.',
            type: 'decision',
            automated: false,
            estimatedDurationSeconds: 60,
          },
          {
            order: 4,
            title: 'Drain and Retry Queues',
            description: 'Replay all queued connector requests on new route.',
            type: 'action',
            automated: true,
            estimatedDurationSeconds: 180,
          },
          {
            order: 5,
            title: 'Notify Affected Tenants',
            description: 'Send status page update and ETA to impacted clients.',
            type: 'notify',
            automated: false,
            estimatedDurationSeconds: 90,
          },
        ] as RunbookStep[],
      },
      {
        id: 'rb-003',
        title: 'Memory Leak — Worker Restart',
        trigger: 'memory_leak_detected',
        mode: 'automatic',
        executionCount: 5,
        avgResolutionMinutes: 3,
        lastUsedAt: '2026-07-11T09:10:00Z',
        createdAt: '2026-03-10T00:00:00Z',
        steps: [
          {
            order: 1,
            title: 'Drain Worker Queue',
            description: 'Stop accepting new tasks and wait for in-flight tasks to complete.',
            type: 'action',
            automated: true,
            estimatedDurationSeconds: 60,
          },
          {
            order: 2,
            title: 'Capture Heap Dump',
            description: 'Capture heap snapshot for post-mortem analysis.',
            type: 'action',
            automated: true,
            estimatedDurationSeconds: 30,
          },
          {
            order: 3,
            title: 'Restart Worker Process',
            description: 'Perform graceful restart with fresh memory allocation.',
            type: 'action',
            automated: true,
            estimatedDurationSeconds: 20,
          },
          {
            order: 4,
            title: 'Verify Heap Normalized',
            description: 'Confirm heap usage drops below 60% post-restart.',
            type: 'check',
            automated: true,
            estimatedDurationSeconds: 30,
          },
        ] as RunbookStep[],
      },
      {
        id: 'rb-004',
        title: 'Worker Node Down',
        trigger: 'worker_down',
        mode: 'assisted',
        executionCount: 2,
        avgResolutionMinutes: 18,
        lastUsedAt: '2026-07-05T03:22:00Z',
        createdAt: '2026-02-15T00:00:00Z',
        steps: [
          {
            order: 1,
            title: 'Confirm Node Status',
            description: 'Verify node is unreachable via health check and SSH.',
            type: 'check',
            automated: true,
            estimatedDurationSeconds: 20,
          },
          {
            order: 2,
            title: 'Redistribute Tasks',
            description: 'Move pending tasks from dead node to healthy workers.',
            type: 'action',
            automated: true,
            estimatedDurationSeconds: 45,
          },
          {
            order: 3,
            title: 'Provision Replacement',
            description: 'Spin up new worker node from latest AMI.',
            type: 'action',
            automated: false,
            estimatedDurationSeconds: 300,
          },
          {
            order: 4,
            title: 'Validate New Node',
            description: 'Run canary task on new node and confirm output.',
            type: 'check',
            automated: false,
            estimatedDurationSeconds: 60,
          },
          {
            order: 5,
            title: 'Update Routing',
            description: 'Add new node to load balancer and routing table.',
            type: 'action',
            automated: true,
            estimatedDurationSeconds: 30,
          },
        ] as RunbookStep[],
      },
      {
        id: 'rb-005',
        title: 'Gateway Overload — Traffic Spike',
        trigger: 'gateway_overload',
        mode: 'manual',
        executionCount: 1,
        avgResolutionMinutes: 6,
        lastUsedAt: '2026-07-11T07:00:00Z',
        createdAt: '2026-04-01T00:00:00Z',
        steps: [
          {
            order: 1,
            title: 'Enable Rate Limiting',
            description: 'Apply per-tenant rate limits to shed excess traffic.',
            type: 'action',
            automated: false,
            estimatedDurationSeconds: 60,
          },
          {
            order: 2,
            title: 'Scale Gateway Nodes',
            description: 'Provision 2 additional gateway nodes behind load balancer.',
            type: 'action',
            automated: false,
            estimatedDurationSeconds: 180,
          },
          {
            order: 3,
            title: 'Monitor and Confirm',
            description: 'Watch CPU and latency metrics for 5 minutes to confirm stabilization.',
            type: 'check',
            automated: false,
            estimatedDurationSeconds: 300,
          },
        ] as RunbookStep[],
      },
    ];

    this.execDashboard = {
      slaUptime: 99.94,
      activeClients: 200,
      monthlyRevenue: 2_450,
      monthlyInfrastructureCost: 1_326,
      availability: 99.94,
      openIncidents: 3,
      resolvedToday: 1,
      mttrMinutes: 12,
    };

    this.opsDashboard = {
      cpuUsage: 62,
      memoryUsage: 71,
      networkThroughputMbps: 1_240,
      dbConnections: 847,
      activeWorkers: 11,
      totalWorkers: 12,
      queueDepth: 427,
      avgProcessingTimeMs: 340,
      nodesHealthy: 6,
      nodesTotal: 8,
    };

    this.aiDashboard = {
      tokensUsedToday: 8_420_000,
      aiCostToday: 84.2,
      modelsInUse: ['claude-opus-4-8', 'claude-haiku-4-5', 'text-embedding-v3'],
      avgInferenceLatencyMs: 620,
      accuracyRate: 97.4,
      cacheHitRate: 68.3,
      totalInferencesToday: 12_500,
    };

    this.connectorMetrics = [
      {
        id: 'conn-sap',
        name: 'SAP S/4HANA',
        type: 'erp',
        successRate: 81.6,
        failureCount: 48,
        avgLatencyMs: 820,
        volumeToday: 1_240,
        lastSyncAt: '2026-07-11T09:36:00Z',
        availability: 94.2,
      },
      {
        id: 'conn-oracle',
        name: 'Oracle EBS',
        type: 'erp',
        successRate: 98.7,
        failureCount: 4,
        avgLatencyMs: 145,
        volumeToday: 980,
        lastSyncAt: '2026-07-11T09:38:00Z',
        availability: 99.8,
      },
      {
        id: 'conn-protheus',
        name: 'TOTVS Protheus',
        type: 'erp',
        successRate: 99.4,
        failureCount: 2,
        avgLatencyMs: 230,
        volumeToday: 2_100,
        lastSyncAt: '2026-07-11T09:39:00Z',
        availability: 99.9,
      },
      {
        id: 'conn-ciss',
        name: 'CISS ERP',
        type: 'erp',
        successRate: 97.8,
        failureCount: 6,
        avgLatencyMs: 180,
        volumeToday: 540,
        lastSyncAt: '2026-07-11T09:37:00Z',
        availability: 99.5,
      },
    ];
  }

  static getInstance(): PrometheusStore {
    if (!PrometheusStore.instance) {
      PrometheusStore.instance = new PrometheusStore();
    }
    return PrometheusStore.instance;
  }

  getTraces(filters: { service?: string; status?: string; limit?: number }): Trace[] {
    let result = [...this.traces];
    if (filters.service) result = result.filter((t) => t.rootService === filters.service);
    if (filters.status) result = result.filter((t) => t.status === filters.status);
    if (filters.limit && filters.limit > 0) result = result.slice(0, filters.limit);
    return result;
  }

  getTraceById(id: string): Trace | undefined {
    return this.traces.find((t) => t.traceId === id);
  }

  getServiceMap(): ServiceMap {
    return this.serviceMapData;
  }

  getTelemetryOverview(): TelemetryOverview {
    return {
      totalTraces: this.traces.length,
      errorTraces: this.traces.filter((t) => t.status === 'error').length,
      timeoutTraces: this.traces.filter((t) => t.status === 'timeout').length,
      avgDurationMs: Math.round(
        this.traces.reduce((s, t) => s + t.totalDurationMs, 0) / this.traces.length
      ),
      p99DurationMs: 5200,
      servicesHealthy: this.serviceMapData.nodes.filter((n) => n.status === 'healthy').length,
      servicesDegraded: this.serviceMapData.nodes.filter((n) => n.status === 'degraded').length,
      servicesDown: this.serviceMapData.nodes.filter((n) => n.status === 'down').length,
      servicesTotal: this.serviceMapData.nodes.length,
      logsPerMin: 4_840,
      activeAlerts: this.anomalies.filter((a) => a.status === 'active').length,
      openIncidents: this.incidents.filter((i) => i.status !== 'resolved').length,
    };
  }

  getDashboard(
    type: DashboardType
  ): ExecutiveDashboard | OperationsDashboard | AIDashboard | ConnectorMetric[] {
    switch (type) {
      case 'executive':
        return this.execDashboard;
      case 'operations':
        return this.opsDashboard;
      case 'ai':
        return this.aiDashboard;
      case 'connectors':
        return this.connectorMetrics;
    }
  }

  getAnomalies(filters: { severity?: string; status?: string }): Anomaly[] {
    let result = [...this.anomalies];
    if (filters.severity) result = result.filter((a) => a.severity === filters.severity);
    if (filters.status) result = result.filter((a) => a.status === filters.status);
    return result;
  }

  getIncidents(filters: { status?: string; severity?: string }): Incident[] {
    let result = [...this.incidents];
    if (filters.status) result = result.filter((i) => i.status === filters.status);
    if (filters.severity) result = result.filter((i) => i.severity === filters.severity);
    return result;
  }

  getIncidentById(id: string): Incident | undefined {
    return this.incidents.find((i) => i.id === id);
  }

  resolveIncident(id: string): Incident | null | 'already_resolved' {
    const idx = this.incidents.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    if (this.incidents[idx].status === 'resolved') return 'already_resolved';
    this.incidents[idx] = {
      ...this.incidents[idx],
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
    };
    return this.incidents[idx];
  }

  getPredictiveAlerts(filters: { type?: string }): PredictiveAlert[] {
    let result = [...this.predictiveAlerts];
    if (filters.type) result = result.filter((a) => a.type === filters.type);
    return result;
  }

  getRecommendations(filters: { category?: string; status?: string }): AIRecommendation[] {
    let result = [...this.recommendations];
    if (filters.category) result = result.filter((r) => r.category === filters.category);
    if (filters.status) result = result.filter((r) => r.status === filters.status);
    return result;
  }

  applyRecommendation(id: string): AIRecommendation | null | 'already_applied' {
    const idx = this.recommendations.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    if (this.recommendations[idx].status === 'applied') return 'already_applied';
    this.recommendations[idx] = {
      ...this.recommendations[idx],
      status: 'applied',
      appliedAt: new Date().toISOString(),
    };
    return this.recommendations[idx];
  }

  dismissRecommendation(id: string): AIRecommendation | null | 'already_dismissed' {
    const idx = this.recommendations.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    if (this.recommendations[idx].status === 'dismissed') return 'already_dismissed';
    this.recommendations[idx] = { ...this.recommendations[idx], status: 'dismissed' };
    return this.recommendations[idx];
  }

  getSelfHealingRules(): SelfHealingRule[] {
    return [...this.selfHealingRules];
  }

  toggleSelfHealingRule(id: string): SelfHealingRule | null {
    const idx = this.selfHealingRules.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    this.selfHealingRules[idx] = {
      ...this.selfHealingRules[idx],
      enabled: !this.selfHealingRules[idx].enabled,
    };
    return this.selfHealingRules[idx];
  }

  getSLOTargets(filters: { tenantId?: string; status?: string }): SLOTarget[] {
    let result = [...this.sloTargets];
    if (filters.tenantId) result = result.filter((s) => s.tenantId === filters.tenantId);
    if (filters.status) result = result.filter((s) => s.status === filters.status);
    return result;
  }

  getCapacityPlan(): CapacityPlan {
    return this.capacityPlan;
  }

  getCostReport(filters: { tenantId?: string }): CostReport {
    if (!filters.tenantId) return this.costReport;
    const tenants = this.costReport.tenants.filter((t) => t.tenantId === filters.tenantId);
    const totalPlatformCost = tenants.reduce((s, t) => s + t.totalCost, 0);
    return { ...this.costReport, tenants, totalPlatformCost };
  }

  getRunbooks(filters: { mode?: string; trigger?: string }): Runbook[] {
    let result = [...this.runbooks];
    if (filters.mode) result = result.filter((r) => r.mode === filters.mode);
    if (filters.trigger) result = result.filter((r) => r.trigger === filters.trigger);
    return result;
  }

  getRunbookById(id: string): Runbook | undefined {
    return this.runbooks.find((r) => r.id === id);
  }

  executeRunbook(id: string): Runbook | null {
    const idx = this.runbooks.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    this.runbooks[idx] = {
      ...this.runbooks[idx],
      executionCount: this.runbooks[idx].executionCount + 1,
      lastUsedAt: new Date().toISOString(),
    };
    return this.runbooks[idx];
  }

  queryCopilot(question: string): CopilotResponse {
    const q = question.toLowerCase();
    const ov = this.getTelemetryOverview();

    let answer: string;
    let sources: string[];
    let confidence: number;
    let relatedMetrics: Array<{ label: string; value: string }>;

    if (
      q.includes('sla') ||
      q.includes('queda') ||
      q.includes('downtime') ||
      q.includes('disponib')
    ) {
      answer =
        'Hoje houve 1 incidente crítico (SAP Connector VPN Timeout às 09:32) que impactou a disponibilidade. O tenant Enterprise atingiu 99.98% vs. meta de 99.99%. MTTR médio de 12 minutos. Tenant Developer está com SLA breached (99.85% vs. meta 99.9%).';
      sources = ['incidents', 'slo', 'telemetry'];
      confidence = 91;
      relatedMetrics = [
        { label: 'Platform Uptime', value: '99.94%' },
        { label: 'Open Incidents', value: `${ov.openIncidents}` },
        { label: 'MTTR', value: '12 min' },
      ];
    } else if (
      q.includes('erro') ||
      q.includes('error') ||
      q.includes('client') ||
      q.includes('falh')
    ) {
      answer = `Os clientes com mais erros hoje: Enterprise (SAP Connector Timeout, 48 falhas), Professional (Oracle timeout, 4 falhas), DevLabs (4 incidentes este mês). Total de ${ov.errorTraces + ov.timeoutTraces} traces com erro/timeout nas últimas horas.`;
      sources = ['incidents', 'anomalies', 'telemetry'];
      confidence = 88;
      relatedMetrics = [
        { label: 'Error Traces', value: `${ov.errorTraces}` },
        { label: 'Active Anomalies', value: `${ov.activeAlerts}` },
        { label: 'SAP Error Rate', value: '18.4%' },
      ];
    } else if (
      q.includes('custo') ||
      q.includes('cost') ||
      q.includes('receita') ||
      q.includes('preco') ||
      q.includes('preço')
    ) {
      const r = this.costReport;
      answer = `Este mês a plataforma gerou receita de R$ ${r.totalRevenue.toLocaleString('pt-BR')} com custo de infraestrutura de R$ ${r.totalPlatformCost.toLocaleString('pt-BR')}. Margem: ${r.margin.toFixed(1)}%. Top clientes por custo: Acme Corp (R$ 740), TechVentures (R$ 380), StartupXYZ (R$ 148).`;
      sources = ['costs', 'billing'];
      confidence = 95;
      relatedMetrics = [
        { label: 'Revenue', value: `R$ ${r.totalRevenue.toLocaleString('pt-BR')}` },
        { label: 'Infra Cost', value: `R$ ${r.totalPlatformCost.toLocaleString('pt-BR')}` },
        { label: 'Margin', value: `${r.margin.toFixed(1)}%` },
      ];
    } else if (
      q.includes('latên') ||
      q.includes('latenc') ||
      q.includes('erp') ||
      q.includes('conect')
    ) {
      answer =
        'O ERP com maior latência hoje é o SAP S/4HANA com média de 820ms (normal: 180ms), causado pelo timeout VPN identificado às 09:32. Oracle EBS está estável em 145ms. TOTVS Protheus em 230ms. Recomendo verificar a rota VPN para o datacenter SAP.';
      sources = ['telemetry', 'connectors', 'incidents'];
      confidence = 87;
      relatedMetrics = [
        { label: 'SAP Latency', value: '820ms' },
        { label: 'Oracle Latency', value: '145ms' },
        { label: 'Connector Availability', value: '98.4%' },
      ];
    } else if (
      q.includes('agent') ||
      q.includes('worker') ||
      q.includes('sobrecarg') ||
      q.includes('overload')
    ) {
      answer =
        'Agent-07 está com 94% de utilização de CPU no Node-1 (acima do threshold de 80%). Recomendação rec-001 sugere migração para Node-3 com economia estimada de 18%. Worker-03 também apresenta pressão de memória em 84% — monitorando possível memory leak no connector pool.';
      sources = ['recommendations', 'anomalies', 'operations'];
      confidence = 93;
      relatedMetrics = [
        { label: 'Agent-07 CPU', value: '94%' },
        { label: 'Worker-03 Memory', value: '84%' },
        { label: 'Queue Depth', value: '427 items' },
      ];
    } else if (
      q.includes('infraestr') ||
      q.includes('expandir') ||
      q.includes('capacidade') ||
      q.includes('crescimento')
    ) {
      const p = this.capacityPlan;
      answer = `Com base no crescimento projetado de ${p.currentClients} para ${p.forecastedClients6m} clientes em 6 meses, recomendo expandir: +14 Workers (urgência alta), +4 Nodes (urgência alta), +4.6TB Storage (urgência média). Custo estimado de expansão: ~R$ 28.000/mês adicional.`;
      sources = ['capacity', 'operations', 'costs'];
      confidence = 89;
      relatedMetrics = [
        { label: 'Current Clients', value: `${p.currentClients}` },
        { label: 'Forecast 6m', value: `${p.forecastedClients6m}` },
        { label: 'Workers Needed', value: '+14' },
      ];
    } else {
      answer = `Analisando: a plataforma está com ${ov.servicesHealthy}/${ov.servicesTotal} serviços saudáveis. Há ${ov.activeAlerts} anomalias ativas e ${ov.openIncidents} incidentes abertos. Para análise mais específica, pergunte sobre: SLA, custos, latência de ERPs, agentes sobrecarregados ou planejamento de capacidade.`;
      sources = ['telemetry', 'anomalies', 'incidents'];
      confidence = 72;
      relatedMetrics = [
        { label: 'Services Healthy', value: `${ov.servicesHealthy}/${ov.servicesTotal}` },
        { label: 'Active Alerts', value: `${ov.activeAlerts}` },
        { label: 'Open Incidents', value: `${ov.openIncidents}` },
      ];
    }

    return {
      question,
      answer,
      sources,
      confidence,
      generatedAt: new Date().toISOString(),
      relatedMetrics,
    };
  }
}

export const prometheusStore = PrometheusStore.getInstance();
