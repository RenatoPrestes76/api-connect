import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RedisSimulation } from '../redis-simulation.js';

describe('RedisSimulation — Strings', () => {
  let r: RedisSimulation;
  beforeEach(() => {
    r = new RedisSimulation();
  });

  it('SET and GET round-trip', () => {
    r.set('k', 'hello');
    expect(r.get('k')).toBe('hello');
  });

  it('GET missing key returns null', () => {
    expect(r.get('nope')).toBeNull();
  });

  it('SET NX succeeds on new key', () => {
    expect(r.setnx('k', 'v')).toBe(true);
    expect(r.get('k')).toBe('v');
  });

  it('SET NX fails on existing key', () => {
    r.set('k', 'original');
    expect(r.setnx('k', 'other')).toBe(false);
    expect(r.get('k')).toBe('original');
  });

  it('INCRBY increments atomically', () => {
    r.set('counter', '10');
    expect(r.incrby('counter', 5)).toBe(15);
    expect(r.incrby('counter', -3)).toBe(12);
  });

  it('INCR on missing key starts at 1', () => {
    expect(r.incr('n')).toBe(1);
  });

  it('DEL removes key, returns count', () => {
    r.set('a', '1');
    r.set('b', '2');
    expect(r.del('a', 'b', 'c')).toBe(2);
    expect(r.get('a')).toBeNull();
  });

  it('EXISTS returns correct truth', () => {
    r.set('x', 'y');
    expect(r.exists('x')).toBe(true);
    expect(r.exists('z')).toBe(false);
  });

  it('TTL returns -1 for persistent key', () => {
    r.set('k', 'v');
    expect(r.ttl('k')).toBe(-1);
  });

  it('TTL returns -2 for missing key', () => {
    expect(r.ttl('missing')).toBe(-2);
  });
});

describe('RedisSimulation — TTL expiry (fake timers)', () => {
  let r: RedisSimulation;
  beforeEach(() => {
    r = new RedisSimulation();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('key disappears after EX seconds', () => {
    r.set('k', 'val', { ex: 5 });
    expect(r.get('k')).toBe('val');
    vi.advanceTimersByTime(6_000);
    expect(r.get('k')).toBeNull();
  });

  it('EXPIRE sets TTL on existing key', () => {
    r.set('k', 'v');
    r.expire('k', 2);
    vi.advanceTimersByTime(3_000);
    expect(r.get('k')).toBeNull();
  });
});

describe('RedisSimulation — Hashes', () => {
  let r: RedisSimulation;
  beforeEach(() => {
    r = new RedisSimulation();
  });

  it('HSET/HGET stores and retrieves', () => {
    r.hset('h', 'field', 'value');
    expect(r.hget('h', 'field')).toBe('value');
  });

  it('HGETALL returns all fields', () => {
    r.hset('h', { a: '1', b: '2' });
    expect(r.hgetall('h')).toEqual({ a: '1', b: '2' });
  });

  it('HGETALL on missing key returns null', () => {
    expect(r.hgetall('nope')).toBeNull();
  });

  it('HDEL removes a field', () => {
    r.hset('h', { a: '1', b: '2' });
    r.hdel('h', 'a');
    expect(r.hget('h', 'a')).toBeNull();
    expect(r.hget('h', 'b')).toBe('2');
  });

  it('HKEYS / HVALS', () => {
    r.hset('h', { x: '1', y: '2' });
    expect(r.hkeys('h').sort()).toEqual(['x', 'y']);
    expect(r.hvals('h').sort()).toEqual(['1', '2']);
  });
});

describe('RedisSimulation — Lists', () => {
  let r: RedisSimulation;
  beforeEach(() => {
    r = new RedisSimulation();
  });

  it('RPUSH / LPOP behaves as FIFO queue', () => {
    r.rpush('q', 'a', 'b', 'c');
    expect(r.lpop('q')).toBe('a');
    expect(r.lpop('q')).toBe('b');
    expect(r.llen('q')).toBe(1);
  });

  it('LPUSH / RPOP behaves as stack', () => {
    r.lpush('s', 'a', 'b');
    expect(r.rpop('s')).toBe('a');
  });

  it('LRANGE returns slice', () => {
    r.rpush('l', '0', '1', '2', '3');
    expect(r.lrange('l', 0, 1)).toEqual(['0', '1']);
    expect(r.lrange('l', -1, -1)).toEqual(['3']);
  });
});

describe('RedisSimulation — Sets', () => {
  let r: RedisSimulation;
  beforeEach(() => {
    r = new RedisSimulation();
  });

  it('SADD / SMEMBERS', () => {
    r.sadd('s', 'a', 'b', 'c');
    expect(r.smembers('s').sort()).toEqual(['a', 'b', 'c']);
  });

  it('SCARD / SISMEMBER', () => {
    r.sadd('s', 'x', 'y');
    expect(r.scard('s')).toBe(2);
    expect(r.sismember('s', 'x')).toBe(true);
    expect(r.sismember('s', 'z')).toBe(false);
  });
});

describe('RedisSimulation — Sorted Sets', () => {
  let r: RedisSimulation;
  beforeEach(() => {
    r = new RedisSimulation();
  });

  it('ZADD / ZRANGE returns by score asc', () => {
    r.zadd('z', 3, 'c');
    r.zadd('z', 1, 'a');
    r.zadd('z', 2, 'b');
    expect(r.zrange('z', 0, -1)).toEqual(['a', 'b', 'c']);
  });

  it('ZSCORE returns the score', () => {
    r.zadd('z', 42, 'm');
    expect(r.zscore('z', 'm')).toBe(42);
    expect(r.zscore('z', 'x')).toBeNull();
  });

  it('ZRANGEBYSCORE filters by range', () => {
    r.zadd('z', 1, 'a');
    r.zadd('z', 5, 'b');
    r.zadd('z', 10, 'c');
    expect(r.zrangebyscore('z', 2, 8)).toEqual(['b']);
  });
});

describe('RedisSimulation — Pub/Sub', () => {
  let r: RedisSimulation;
  beforeEach(() => {
    r = new RedisSimulation();
  });

  it('PUBLISH delivers to subscribers', () => {
    const received: string[] = [];
    r.subscribe('chan', (m) => received.push(m));
    r.publish('chan', 'hello');
    expect(received).toEqual(['hello']);
  });

  it('UNSUBSCRIBE removes listener', () => {
    const received: string[] = [];
    const fn = (m: string) => received.push(m);
    r.subscribe('ch', fn);
    r.unsubscribe('ch', fn);
    r.publish('ch', 'msg');
    expect(received).toHaveLength(0);
  });

  it('FLUSHALL clears all data', () => {
    r.set('k', 'v');
    r.hset('h', 'f', 'v');
    r.rpush('l', 'x');
    r.flushall();
    expect(r.dbsize()).toBe(0);
  });
});
