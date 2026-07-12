import type { RedisSetOptions } from './types.js';

class RedisEntry {
  value: string;
  expiresAt: number | null;

  constructor(value: string, options?: { ex?: number; px?: number }) {
    this.value = value;
    if (options?.ex != null) {
      this.expiresAt = Date.now() + options.ex * 1000;
    } else if (options?.px != null) {
      this.expiresAt = Date.now() + options.px;
    } else {
      this.expiresAt = null;
    }
  }

  isExpired(): boolean {
    return this.expiresAt !== null && Date.now() > this.expiresAt;
  }
}

export class RedisSimulation {
  private strings = new Map<string, RedisEntry>();
  private hashes = new Map<string, Map<string, string>>();
  private lists = new Map<string, string[]>();
  private sets = new Map<string, Set<string>>();
  private sortedSets = new Map<string, Map<string, number>>();
  private pubsub = new Map<string, Array<(msg: string) => void>>();

  private getEntry(key: string): RedisEntry | null {
    const entry = this.strings.get(key);
    if (!entry) return null;
    if (entry.isExpired()) {
      this.strings.delete(key);
      return null;
    }
    return entry;
  }

  // ─── Strings ───────────────────────────────────────────────────────────────
  get(key: string): string | null {
    return this.getEntry(key)?.value ?? null;
  }

  set(key: string, value: string, options?: RedisSetOptions): 'OK' | null {
    if (options?.nx && this.getEntry(key) !== null) return null;
    if (options?.xx && this.getEntry(key) === null) return null;
    this.strings.set(key, new RedisEntry(value, options));
    return 'OK';
  }

  setnx(key: string, value: string): boolean {
    return this.set(key, value, { nx: true }) === 'OK';
  }

  getset(key: string, value: string): string | null {
    const prev = this.get(key);
    this.set(key, value);
    return prev;
  }

  del(...keys: string[]): number {
    let count = 0;
    for (const k of keys) {
      if (
        this.strings.delete(k) ||
        this.hashes.delete(k) ||
        this.lists.delete(k) ||
        this.sets.delete(k) ||
        this.sortedSets.delete(k)
      ) {
        count++;
      }
    }
    return count;
  }

  exists(key: string): boolean {
    return this.getEntry(key) !== null;
  }

  expire(key: string, seconds: number): boolean {
    const entry = this.getEntry(key);
    if (!entry) return false;
    entry.expiresAt = Date.now() + seconds * 1000;
    return true;
  }

  pexpire(key: string, ms: number): boolean {
    const entry = this.getEntry(key);
    if (!entry) return false;
    entry.expiresAt = Date.now() + ms;
    return true;
  }

  ttl(key: string): number {
    const entry = this.getEntry(key);
    if (!entry) return -2;
    if (entry.expiresAt === null) return -1;
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  }

  pttl(key: string): number {
    const entry = this.getEntry(key);
    if (!entry) return -2;
    if (entry.expiresAt === null) return -1;
    return Math.max(0, entry.expiresAt - Date.now());
  }

  incr(key: string): number {
    return this.incrby(key, 1);
  }
  decr(key: string): number {
    return this.incrby(key, -1);
  }

  incrby(key: string, n: number): number {
    const cur = parseInt(this.get(key) ?? '0', 10);
    const next = cur + n;
    this.set(key, String(next));
    return next;
  }

  decrby(key: string, n: number): number {
    return this.incrby(key, -n);
  }

  keys(pattern = '*'): string[] {
    const allKeys = [
      ...this.strings.keys(),
      ...this.hashes.keys(),
      ...this.lists.keys(),
      ...this.sets.keys(),
      ...this.sortedSets.keys(),
    ].filter((k) => {
      const entry = this.strings.get(k);
      return !entry || !entry.isExpired();
    });
    const regex = new RegExp(
      '^' +
        pattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.') +
        '$'
    );
    return [...new Set(allKeys)].filter((k) => regex.test(k));
  }

  // ─── Hashes ────────────────────────────────────────────────────────────────
  hset(key: string, field: string, value: string): number;
  hset(key: string, fields: Record<string, string>): number;
  hset(key: string, fieldOrObj: string | Record<string, string>, value?: string): number {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    const hash = this.hashes.get(key)!;
    if (typeof fieldOrObj === 'string') {
      const added = hash.has(fieldOrObj) ? 0 : 1;
      hash.set(fieldOrObj, value!);
      return added;
    }
    let added = 0;
    for (const [f, v] of Object.entries(fieldOrObj)) {
      if (!hash.has(f)) added++;
      hash.set(f, v);
    }
    return added;
  }

  hget(key: string, field: string): string | null {
    return this.hashes.get(key)?.get(field) ?? null;
  }

  hmget(key: string, ...fields: string[]): Array<string | null> {
    const hash = this.hashes.get(key);
    return fields.map((f) => hash?.get(f) ?? null);
  }

  hgetall(key: string): Record<string, string> | null {
    const hash = this.hashes.get(key);
    return hash ? Object.fromEntries(hash) : null;
  }

  hdel(key: string, ...fields: string[]): number {
    const hash = this.hashes.get(key);
    if (!hash) return 0;
    let count = 0;
    for (const f of fields) if (hash.delete(f)) count++;
    return count;
  }

  hexists(key: string, field: string): boolean {
    return this.hashes.get(key)?.has(field) ?? false;
  }

  hkeys(key: string): string[] {
    return [...(this.hashes.get(key)?.keys() ?? [])];
  }
  hvals(key: string): string[] {
    return [...(this.hashes.get(key)?.values() ?? [])];
  }
  hlen(key: string): number {
    return this.hashes.get(key)?.size ?? 0;
  }

  // ─── Lists ─────────────────────────────────────────────────────────────────
  lpush(key: string, ...values: string[]): number {
    if (!this.lists.has(key)) this.lists.set(key, []);
    const list = this.lists.get(key)!;
    list.unshift(...values.reverse());
    return list.length;
  }

  rpush(key: string, ...values: string[]): number {
    if (!this.lists.has(key)) this.lists.set(key, []);
    const list = this.lists.get(key)!;
    list.push(...values);
    return list.length;
  }

  lpop(key: string): string | null {
    return this.lists.get(key)?.shift() ?? null;
  }
  rpop(key: string): string | null {
    return this.lists.get(key)?.pop() ?? null;
  }
  llen(key: string): number {
    return this.lists.get(key)?.length ?? 0;
  }

  lrange(key: string, start: number, stop: number): string[] {
    const list = this.lists.get(key) ?? [];
    const end = stop < 0 ? list.length + stop + 1 : stop + 1;
    return list.slice(start, end);
  }

  // ─── Sets ──────────────────────────────────────────────────────────────────
  sadd(key: string, ...members: string[]): number {
    if (!this.sets.has(key)) this.sets.set(key, new Set());
    const set = this.sets.get(key)!;
    let added = 0;
    for (const m of members)
      if (!set.has(m)) {
        set.add(m);
        added++;
      }
    return added;
  }

  smembers(key: string): string[] {
    return [...(this.sets.get(key) ?? [])];
  }
  sismember(key: string, member: string): boolean {
    return this.sets.get(key)?.has(member) ?? false;
  }
  scard(key: string): number {
    return this.sets.get(key)?.size ?? 0;
  }

  srem(key: string, ...members: string[]): number {
    const set = this.sets.get(key);
    if (!set) return 0;
    let count = 0;
    for (const m of members) if (set.delete(m)) count++;
    return count;
  }

  // ─── Sorted Sets ───────────────────────────────────────────────────────────
  zadd(key: string, score: number, member: string): number {
    if (!this.sortedSets.has(key)) this.sortedSets.set(key, new Map());
    const zset = this.sortedSets.get(key)!;
    const added = zset.has(member) ? 0 : 1;
    zset.set(member, score);
    return added;
  }

  zscore(key: string, member: string): number | null {
    return this.sortedSets.get(key)?.get(member) ?? null;
  }

  zcard(key: string): number {
    return this.sortedSets.get(key)?.size ?? 0;
  }

  zrange(key: string, start: number, stop: number): string[] {
    const zset = this.sortedSets.get(key);
    if (!zset) return [];
    const sorted = [...zset.entries()].sort((a, b) => a[1] - b[1]);
    const end = stop < 0 ? sorted.length + stop + 1 : stop + 1;
    return sorted.slice(start, end).map(([m]) => m);
  }

  zrangebyscore(key: string, min: number, max: number): string[] {
    const zset = this.sortedSets.get(key);
    if (!zset) return [];
    return [...zset.entries()]
      .filter(([, s]) => s >= min && s <= max)
      .sort((a, b) => a[1] - b[1])
      .map(([m]) => m);
  }

  zrem(key: string, ...members: string[]): number {
    const zset = this.sortedSets.get(key);
    if (!zset) return 0;
    let count = 0;
    for (const m of members) if (zset.delete(m)) count++;
    return count;
  }

  zincrby(key: string, increment: number, member: string): number {
    const current = this.zscore(key, member) ?? 0;
    const next = current + increment;
    this.zadd(key, next, member);
    return next;
  }

  // ─── Pub/Sub ───────────────────────────────────────────────────────────────
  subscribe(channel: string, callback: (msg: string) => void): void {
    if (!this.pubsub.has(channel)) this.pubsub.set(channel, []);
    this.pubsub.get(channel)!.push(callback);
  }

  unsubscribe(channel: string, callback?: (msg: string) => void): void {
    if (!callback) {
      this.pubsub.delete(channel);
      return;
    }
    const listeners = this.pubsub.get(channel);
    if (!listeners) return;
    const idx = listeners.indexOf(callback);
    if (idx > -1) listeners.splice(idx, 1);
  }

  publish(channel: string, message: string): number {
    const listeners = this.pubsub.get(channel) ?? [];
    for (const fn of listeners) fn(message);
    return listeners.length;
  }

  // ─── Admin ─────────────────────────────────────────────────────────────────
  flushall(): void {
    this.strings.clear();
    this.hashes.clear();
    this.lists.clear();
    this.sets.clear();
    this.sortedSets.clear();
    this.pubsub.clear();
  }

  dbsize(): number {
    return (
      this.strings.size + this.hashes.size + this.lists.size + this.sets.size + this.sortedSets.size
    );
  }
}

export const redis = new RedisSimulation();
