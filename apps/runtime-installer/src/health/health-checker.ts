import os from 'node:os';
import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';

export interface HealthReport {
  ok:           boolean;
  checks:       HealthCheck[];
  checkedAt:    string;
}

export interface HealthCheck {
  name:    string;
  ok:      boolean;
  message: string;
}

export interface HealthOptions {
  runtimeRoot: string;
  apiBaseUrl:  string;
}

export async function runHealthCheck(opts: HealthOptions): Promise<HealthReport> {
  const checks = await Promise.all([
    checkDisk(opts.runtimeRoot),
    checkMemory(),
    checkCpu(),
    checkConnectivity(opts.apiBaseUrl),
  ]);

  return {
    ok:        checks.every((c) => c.ok),
    checks,
    checkedAt: new Date().toISOString(),
  };
}

// ─── Individual checks ────────────────────────────────────────────────────────

async function checkDisk(runtimeRoot: string): Promise<HealthCheck> {
  try {
    const stats = fs.statfsSync(runtimeRoot);
    const freeGb = (stats.bfree * stats.bsize) / 1_073_741_824;
    const ok     = freeGb >= 1;
    return {
      name:    'disk',
      ok,
      message: ok
        ? `${freeGb.toFixed(1)} GB free`
        : `Only ${freeGb.toFixed(1)} GB free (minimum 1 GB required)`,
    };
  } catch {
    return { name: 'disk', ok: true, message: 'disk check skipped (statfs unavailable)' };
  }
}

async function checkMemory(): Promise<HealthCheck> {
  const freeMb  = os.freemem()  / 1_048_576;
  const totalMb = os.totalmem() / 1_048_576;
  const ok      = freeMb >= 128;
  return {
    name:    'memory',
    ok,
    message: ok
      ? `${freeMb.toFixed(0)} MB free of ${totalMb.toFixed(0)} MB`
      : `Only ${freeMb.toFixed(0)} MB free (minimum 128 MB required)`,
  };
}

async function checkCpu(): Promise<HealthCheck> {
  const cpus = os.cpus();
  const ok   = cpus.length >= 1;
  return {
    name:    'cpu',
    ok,
    message: `${cpus.length} logical CPU(s) — ${cpus[0]?.model ?? 'unknown'}`,
  };
}

async function checkConnectivity(apiBaseUrl: string): Promise<HealthCheck> {
  return new Promise((resolve) => {
    try {
      const parsed  = new URL(`${apiBaseUrl.replace(/\/$/, '')}/api/v1/health`);
      const lib     = parsed.protocol === 'https:' ? https : http;
      const timeout = setTimeout(() => {
        resolve({ name: 'connectivity', ok: false, message: 'Timed out connecting to API (5s)' });
      }, 5_000);

      const req = lib.get(parsed.toString(), { rejectUnauthorized: false }, (res) => {
        clearTimeout(timeout);
        res.resume(); // drain
        const ok = res.statusCode !== undefined && res.statusCode < 500;
        resolve({
          name:    'connectivity',
          ok,
          message: ok
            ? `API reachable (HTTP ${res.statusCode})`
            : `API returned HTTP ${res.statusCode}`,
        });
      });

      req.on('error', (err) => {
        clearTimeout(timeout);
        resolve({ name: 'connectivity', ok: false, message: `Cannot reach API: ${err.message}` });
      });
    } catch (err) {
      resolve({ name: 'connectivity', ok: false, message: `Invalid API URL: ${(err as Error).message}` });
    }
  });
}
