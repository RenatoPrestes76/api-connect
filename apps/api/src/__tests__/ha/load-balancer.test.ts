import { describe, it, expect } from 'vitest';
import { LoadBalancer, LoadBalancerError } from '../../modules/ha/load-balancer.js';

describe('LoadBalancer — round_robin', () => {
  it('cycles through eligible online, non-leader nodes in order', () => {
    const lb = new LoadBalancer();
    const first = lb.route('round_robin');
    const second = lb.route('round_robin');
    const third = lb.route('round_robin');
    const fourth = lb.route('round_robin'); // wraps back to the first target

    expect(first.nodeId).not.toBe(second.nodeId);
    expect(fourth.nodeId).toBe(first.nodeId);
  });

  it('excludes the leader node by default', () => {
    const lb = new LoadBalancer();
    for (let i = 0; i < 6; i++) {
      expect(lb.route('round_robin').nodeId).not.toBe('nd-001');
    }
  });

  it('includes the leader when includeLeader is true', () => {
    const lb = new LoadBalancer();
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      seen.add(lb.route('round_robin', { includeLeader: true }).nodeId);
    }
    expect(seen.has('nd-001')).toBe(true);
  });
});

describe('LoadBalancer — least_connections', () => {
  it('routes to the node with fewest active connections', () => {
    const lb = new LoadBalancer();
    const a = lb.route('round_robin');
    const b = lb.route('round_robin');
    // a and b now both have 1 active connection each; release a so it has 0.
    lb.release(a.nodeId);

    const next = lb.route('least_connections');
    expect(next.nodeId).toBe(a.nodeId);
    void b;
  });
});

describe('LoadBalancer — weighted', () => {
  it('is deterministic with an injected rng and biases selection toward the heavier node', () => {
    // Eligible pool (online, non-leader) is nd-002/nd-003/nd-005. With nd-002 weighted
    // 100 against two default weight-1 nodes (total=102), nd-002 owns the [0, 100/102) slice.
    const lowRoll = new LoadBalancer(() => 0.1);
    lowRoll.setWeight('nd-002', 100);
    expect(lowRoll.route('weighted').nodeId).toBe('nd-002');

    const highRoll = new LoadBalancer(() => 0.999);
    highRoll.setWeight('nd-002', 100);
    expect(highRoll.route('weighted').nodeId).not.toBe('nd-002');
  });

  it('rejects non-positive weights', () => {
    const lb = new LoadBalancer();
    expect(() => lb.setWeight('nd-002', 0)).toThrow(LoadBalancerError);
    expect(() => lb.setWeight('nd-002', -5)).toThrow(LoadBalancerError);
  });
});

describe('LoadBalancer — distribution and release', () => {
  it('tracks totalRouted and activeConnections per node', () => {
    const lb = new LoadBalancer();
    const decision = lb.route('round_robin');
    let dist = lb.getDistribution().find((d) => d.nodeId === decision.nodeId)!;
    expect(dist.activeConnections).toBe(1);
    expect(dist.totalRouted).toBe(1);

    lb.release(decision.nodeId);
    dist = lb.getDistribution().find((d) => d.nodeId === decision.nodeId)!;
    expect(dist.activeConnections).toBe(0);
    expect(dist.totalRouted).toBe(1); // totalRouted is cumulative, not decremented by release
  });

  it('release on a node with no active connections is a no-op, not an error', () => {
    const lb = new LoadBalancer();
    expect(() => lb.release('nd-002')).not.toThrow();
  });
});
