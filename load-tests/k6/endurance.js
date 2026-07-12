/**
 * k6 Endurance / Soak Test — Sprint 36 TITAN
 * 30 VUs for 2 hours — checks for memory leaks, connection pool exhaustion, and gradual degradation.
 * Usage: k6 run endurance.js -e BASE_URL=http://localhost:3001
 * Note: --duration can be overridden with: k6 run endurance.js --duration 2h
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errors = new Rate('error_rate');
const latencyTrend = new Trend('latency_over_time', true);

export const options = {
  vus: 30,
  duration: '2h',
  thresholds: {
    http_req_duration: ['p(95)<400'],  // slightly looser for endurance
    http_req_failed: ['rate<0.005'],    // 0.5% max error rate
    error_rate: ['rate<0.005'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer test-token',
  'x-tenant-id': 'tenant-enterprise',
};

const ENDPOINTS = [
  { method: 'GET', path: '/api/v1/ops/health' },
  { method: 'GET', path: '/api/v1/ops/dashboard' },
  { method: 'GET', path: '/api/v1/ops/feature-flags' },
  { method: 'GET', path: '/api/v1/ops/slo' },
  { method: 'GET', path: '/api/v1/ops/circuit-breakers' },
  { method: 'GET', path: '/api/v1/ops/queues' },
  { method: 'GET', path: '/api/v1/ops/dr' },
];

export default function () {
  const ep = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
  const r = http.request(ep.method, `${BASE_URL}${ep.path}`, null, { headers: HEADERS });
  latencyTrend.add(r.timings.duration);
  errors.add(r.status >= 500);
  check(r, {
    'status 2xx': (r) => r.status >= 200 && r.status < 300,
  });
  sleep(2);
}
