import { RedisSimulation, redis as defaultRedis } from './redis-simulation.js';
import type { LockAcquisition } from './types.js';

function generateToken(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export class DistributedLock {
  constructor(private readonly store: RedisSimulation = defaultRedis) {}

  private key(resource: string): string {
    return `lock:${resource}`;
  }

  acquire(resource: string, ttlMs = 30_000): LockAcquisition | null {
    const token = generateToken();
    const k = this.key(resource);
    const ok = this.store.set(k, token, { nx: true, px: ttlMs });
    if (ok !== 'OK') return null;
    return {
      resource,
      token,
      acquiredAt: new Date().toISOString(),
      ttlMs,
    };
  }

  release(resource: string, token: string): boolean {
    const k = this.key(resource);
    const current = this.store.get(k);
    if (current !== token) return false;
    this.store.del(k);
    return true;
  }

  extend(resource: string, token: string, ttlMs = 30_000): boolean {
    const k = this.key(resource);
    const current = this.store.get(k);
    if (current !== token) return false;
    return this.store.pexpire(k, ttlMs);
  }

  isLocked(resource: string): boolean {
    return this.store.exists(this.key(resource));
  }

  remainingMs(resource: string): number {
    return this.store.pttl(this.key(resource));
  }
}

export const distributedLock = new DistributedLock();
