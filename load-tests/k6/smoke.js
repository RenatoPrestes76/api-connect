/**
 * k6 Smoke Test — Sprint 36 TITAN
 * Quick sanity check: 1 VU for 30s, verifies core endpoints respond correctly.
 * Usage: k6 run smoke.js -e BASE_URL=http://localhost:3001
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer test-token',
  'x-tenant-id': 'tenant-enterprise',
};

export default function () {
  // Health checks
  const health = http.get(`${BASE_URL}/api/v1/ops/health`, { headers: HEADERS });
  check(health, {
    'health 200 or 207': (r) => [200, 207].includes(r.status),
    'health has status field': (r) => JSON.parse(r.body).status !== undefined,
    'health < 200ms': (r) => r.timings.duration < 200,
  });

  // Dashboard
  const dashboard = http.get(`${BASE_URL}/api/v1/ops/dashboard`, { headers: HEADERS });
  check(dashboard, {
    'dashboard 200': (r) => r.status === 200,
    'dashboard has kpis': (r) => JSON.parse(r.body).kpis !== undefined,
  });

  // Feature flags
  const flags = http.get(`${BASE_URL}/api/v1/ops/feature-flags`, { headers: HEADERS });
  check(flags, {
    'flags 200': (r) => r.status === 200,
    'flags has items': (r) => JSON.parse(r.body).total > 0,
  });

  // SLOs
  const slo = http.get(`${BASE_URL}/api/v1/ops/slo`, { headers: HEADERS });
  check(slo, {
    'slo 200': (r) => r.status === 200,
  });

  sleep(1);
}
