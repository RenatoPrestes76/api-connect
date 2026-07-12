import type { CircuitState, CircuitBreakerOptions, CircuitBreakerMetrics } from './types.js';

export class CircuitOpenError extends Error {
  constructor(public readonly circuitName: string) {
    super(`Circuit '${circuitName}' is OPEN — request rejected`);
    this.name = 'CircuitOpenError';
  }
}

export class CircuitBreaker {
  readonly name: string;
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private totalRequests = 0;
  private rejectedRequests = 0;
  private lastFailureTime: number | null = null;
  private lastStateChange: number;
  private openedAt: number | null = null;

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;
  private readonly clock: () => number;

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 2;
    this.timeout = options.timeout ?? 60_000;
    this.clock = options.clock ?? (() => Date.now());
    this.lastStateChange = this.clock();
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;
    const now = this.clock();

    if (this.state === 'OPEN') {
      if (now - (this.openedAt ?? 0) >= this.timeout) {
        this.transition('HALF_OPEN');
      } else {
        this.rejectedRequests++;
        throw new CircuitOpenError(this.name);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      if (!(error instanceof CircuitOpenError)) this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.transition('CLOSED');
        this.failures = 0;
        this.successes = 0;
      }
    } else {
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = this.clock();
    if (this.state === 'HALF_OPEN') {
      this.transition('OPEN');
      this.successes = 0;
    } else if (this.failures >= this.failureThreshold) {
      this.transition('OPEN');
    }
  }

  private transition(next: CircuitState): void {
    const now = this.clock();
    this.state = next;
    this.lastStateChange = now;
    if (next === 'OPEN') {
      this.openedAt = now;
    } else if (next === 'CLOSED') {
      this.openedAt = null;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalRequests: this.totalRequests,
      rejectedRequests: this.rejectedRequests,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      lastStateChange: new Date(this.lastStateChange).toISOString(),
      openedAt: this.openedAt ? new Date(this.openedAt).toISOString() : null,
    };
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.openedAt = null;
    this.rejectedRequests = 0;
    this.lastStateChange = this.clock();
  }
}

export class CircuitBreakerRegistry {
  private registry = new Map<string, CircuitBreaker>();

  register(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this.registry.has(name)) {
      this.registry.set(name, new CircuitBreaker(name, options));
    }
    return this.registry.get(name)!;
  }

  get(name: string): CircuitBreaker | undefined {
    return this.registry.get(name);
  }

  list(): CircuitBreakerMetrics[] {
    return [...this.registry.values()].map((cb) => cb.getMetrics());
  }

  reset(name: string): boolean {
    const cb = this.registry.get(name);
    if (!cb) return false;
    cb.reset();
    return true;
  }
}

export const circuitRegistry = new CircuitBreakerRegistry();
