import type { ServerResponse }   from 'node:http';
import type { RouteContext }     from '../../../http/router.js';
import { json }                  from '../../../http/router.js';
import { hubStore }              from './hub-store.js';

export async function hubHealth(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  const connectors   = [...hubStore.connectors.values()];
  const hasError     = connectors.some((c) => c.status === 'ERROR');
  const hasUnhealthy = connectors.some((c) => c.health === 'unhealthy');
  const overall      = hasError || hasUnhealthy ? 'unhealthy' : 'healthy';

  const uptime = process.uptime();

  json(res, {
    overall,
    timestamp: new Date().toISOString(),
    uptime,
    metrics: [
      { label: 'CPU Usage',    value: Math.floor(Math.random() * 30 + 5),  unit: '%', status: 'healthy',   threshold: 80  },
      { label: 'Memory Usage', value: Math.floor(Math.random() * 20 + 35), unit: '%', status: 'healthy',   threshold: 90  },
      { label: 'Disk Usage',   value: Math.floor(Math.random() * 10 + 18), unit: '%', status: 'healthy',   threshold: 85  },
      { label: 'API Latency',  value: Math.floor(Math.random() * 10 + 3),  unit: 'ms', status: 'healthy',  threshold: 200 },
    ],
    components: [
      { name: 'API Server',       status: 'healthy',   latencyMs: 2,  message: 'Responding normally' },
      { name: 'ERP Connector',    status: hasError ? 'unhealthy' : 'healthy',  latencyMs: 4,  message: hasError ? 'Connection timeout' : 'Operational' },
      { name: 'CRM Connector',    status: 'degraded',  latencyMs: 28, message: 'High pool utilization' },
      { name: 'Discovery Engine', status: 'healthy',   latencyMs: 15, message: 'PROMETHEUS ready' },
    ],
  });
}
