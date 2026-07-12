/**
 * k6 Load Test — Sprint 36 TITAN
 * Validates P95 < 300ms and error rate < 1% under sustained 50-100 VU load.
 * Usage: k6 run load.js -e BASE_URL=http://localhost:3001
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errors = new Rate('error_rate');
const apiLatency = new Trend('api_latency_ms', true);
const flagEvals = new Counter('flag_evaluations');

export const options = {
  stages: [
    { duration: '2m', target: 20 },   // warm up
    { duration: '5m', target: 50 },   // steady 50 VUs
    { duration: '2m', target: 100 },  // ramp up to 100
    { duration: '5m', target: 100 },  // steady 100 VUs
    { duration: '2m', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<600'],
    http_req_failed: ['rate<0.01'],
    error_rate: ['rate<0.01'],
    api_latency_ms: ['p(95)<300'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer test-token',
  'x-tenant-id': 'tenant-enterprise',
};

const TENANTS = ['tenant-enterprise', 'tenant-professional', 'tenant-community'];
const FLAG_IDS = ['ff-001', 'ff-002', 'ff-003', 'ff-004', 'ff-005'];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export default function () {
  group('ops-health', () => {
    const r = http.get(`${BASE_URL}/api/v1/ops/health`, { headers: HEADERS });
    apiLatency.add(r.timings.duration);
    errors.add(r.status >= 500);
    check(r, { 'health ok': (r) => [200, 207].includes(r.status) });
  });

  group('feature-flag-evaluation', () => {
    const flagId = rand(FLAG_IDS);
    const tenantId = rand(TENANTS);
    const r = http.post(
      `${BASE_URL}/api/v1/ops/feature-flags/${flagId}/evaluate`,
      JSON.stringify({ context: { tenantId, plan: 'enterprise' } }),
      { headers: HEADERS }
    );
    apiLatency.add(r.timings.duration);
    errors.add(r.status >= 500);
    if (r.status === 200) flagEvals.add(1);
    check(r, { 'flag eval 200': (r) => r.status === 200 });
  });

  group('queue-enqueue', () => {
    const r = http.post(
      `${BASE_URL}/api/v1/ops/queues/enqueue`,
      JSON.stringify({ type: 'load_test_job', priority: 'low', tenantId: rand(TENANTS) }),
      { headers: HEADERS }
    );
    apiLatency.add(r.timings.duration);
    errors.add(r.status >= 500);
    check(r, { 'enqueue 201': (r) => r.status === 201 });
  });

  group('slo-read', () => {
    const r = http.get(`${BASE_URL}/api/v1/ops/slo`, { headers: HEADERS });
    apiLatency.add(r.timings.duration);
    errors.add(r.status >= 500);
    check(r, { 'slo 200': (r) => r.status === 200 });
  });

  sleep(Math.random() * 0.5 + 0.1); // 100-600ms think time
}
