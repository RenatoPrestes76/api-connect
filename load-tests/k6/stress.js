/**
 * k6 Stress Test — Sprint 36 TITAN
 * Pushes past expected limits to find breaking points and verify graceful degradation.
 * Usage: k6 run stress.js -e BASE_URL=http://localhost:3001
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errors = new Rate('error_rate');

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '2m', target: 300 },  // stress
    { duration: '2m', target: 400 },  // beyond expected capacity
    { duration: '3m', target: 0 },    // ramp down and recovery
  ],
  thresholds: {
    // Allow higher error rates during stress, but must recover
    http_req_failed: ['rate<0.15'],
    error_rate: ['rate<0.15'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const HEADERS = {
  Authorization: 'Bearer test-token',
  'x-tenant-id': 'tenant-enterprise',
};

export default function () {
  const r = http.get(`${BASE_URL}/api/v1/ops/health`, { headers: HEADERS });
  errors.add(r.status >= 500);
  check(r, {
    'not 5xx': (r) => r.status < 500,
    'responds': (r) => r.status !== 0,
  });
  sleep(0.1);
}

export function handleSummary(data) {
  const p95 = data.metrics['http_req_duration']?.values['p(95)'] ?? 0;
  const errorRate = data.metrics['http_req_failed']?.values['rate'] ?? 0;
  return {
    'stdout': `\n=== STRESS TEST SUMMARY ===\nP95 latency: ${p95.toFixed(0)}ms\nError rate: ${(errorRate * 100).toFixed(2)}%\n`,
  };
}
