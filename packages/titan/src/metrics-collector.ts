import type { LatencyStats, ThroughputStats, ErrorRateStats, MetricsSnapshot } from './types.js';

const MAX_SAMPLES = 10_000;

function sortedPercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)]!;
}

export class LatencyHistogram {
  private samples: number[] = [];

  record(latencyMs: number): void {
    this.samples.push(latencyMs);
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
  }

  getStats(): LatencyStats {
    if (this.samples.length === 0) {
      return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, mean: 0, count: 0 };
    }
    const sorted = [...this.samples].sort((a, b) => a - b);
    const mean = this.samples.reduce((s, v) => s + v, 0) / this.samples.length;
    return {
      p50: sortedPercentile(sorted, 50),
      p95: sortedPercentile(sorted, 95),
      p99: sortedPercentile(sorted, 99),
      min: sorted[0]!,
      max: sorted[sorted.length - 1]!,
      mean: Math.round(mean * 10) / 10,
      count: this.samples.length,
    };
  }

  reset(): void {
    this.samples = [];
  }
}

export class ThroughputCounter {
  private total = 0;
  private windowMs: number;
  private timestamps: number[] = [];

  constructor(windowMs = 60_000) {
    this.windowMs = windowMs;
  }

  record(): void {
    const now = Date.now();
    this.total++;
    this.timestamps.push(now);
    // trim old
    const cutoff = now - this.windowMs;
    while (this.timestamps.length > 0 && this.timestamps[0]! < cutoff) {
      this.timestamps.shift();
    }
  }

  getStats(): ThroughputStats {
    const now = Date.now();
    const inWindow = this.timestamps.filter((t) => t >= now - this.windowMs).length;
    const perMinute = inWindow / (this.windowMs / 60_000);
    return {
      requestsPerSecond: Math.round((inWindow / (this.windowMs / 1000)) * 100) / 100,
      requestsPerMinute: Math.round(perMinute),
      totalRequests: this.total,
    };
  }

  reset(): void {
    this.total = 0;
    this.timestamps = [];
  }
}

export class ErrorRateTracker {
  private errors = 0;
  private total = 0;
  private lastError: string | null = null;
  private lastErrorTime: string | null = null;

  record(isError: boolean, errorMessage?: string): void {
    this.total++;
    if (isError) {
      this.errors++;
      this.lastError = errorMessage ?? 'unknown error';
      this.lastErrorTime = new Date().toISOString();
    }
  }

  getStats(): ErrorRateStats {
    return {
      errorRate: this.total === 0 ? 0 : Math.round((this.errors / this.total) * 10000) / 10000,
      errorCount: this.errors,
      totalCount: this.total,
      lastError: this.lastError ?? undefined,
      lastErrorTime: this.lastErrorTime ?? undefined,
    };
  }

  reset(): void {
    this.errors = 0;
    this.total = 0;
    this.lastError = null;
    this.lastErrorTime = null;
  }
}

export class MetricsCollector {
  readonly latency: LatencyHistogram;
  readonly throughput: ThroughputCounter;
  readonly errorRate: ErrorRateTracker;

  private perRoute = new Map<string, LatencyHistogram>();

  constructor(windowMs = 60_000) {
    this.latency = new LatencyHistogram();
    this.throughput = new ThroughputCounter(windowMs);
    this.errorRate = new ErrorRateTracker();
  }

  record(latencyMs: number, isError = false, route?: string, errorMessage?: string): void {
    this.latency.record(latencyMs);
    this.throughput.record();
    this.errorRate.record(isError, errorMessage);
    if (route) {
      if (!this.perRoute.has(route)) this.perRoute.set(route, new LatencyHistogram());
      this.perRoute.get(route)!.record(latencyMs);
    }
  }

  snapshot(): MetricsSnapshot {
    return {
      latency: this.latency.getStats(),
      throughput: this.throughput.getStats(),
      errorRate: this.errorRate.getStats(),
      timestamp: new Date().toISOString(),
    };
  }

  routeStats(route: string): LatencyStats | null {
    return this.perRoute.get(route)?.getStats() ?? null;
  }

  topRoutes(n = 10): Array<{ route: string; stats: LatencyStats }> {
    return [...this.perRoute.entries()]
      .map(([route, hist]) => ({ route, stats: hist.getStats() }))
      .sort((a, b) => b.stats.count - a.stats.count)
      .slice(0, n);
  }

  reset(): void {
    this.latency.reset();
    this.throughput.reset();
    this.errorRate.reset();
    this.perRoute.clear();
  }
}

export const metrics = new MetricsCollector();
