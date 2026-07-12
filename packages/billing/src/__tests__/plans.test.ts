import { describe, it, expect } from 'vitest';
import { PLANS, getPlan, getPlanById, listPlans } from '../plans.js';

describe('PLANS catalog', () => {
  it('has exactly 3 plans', () => {
    expect(PLANS).toHaveLength(3);
  });

  it('plan slugs are unique', () => {
    const slugs = PLANS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(3);
  });

  it('plan ids are unique', () => {
    const ids = PLANS.map((p) => p.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('community plan is free', () => {
    const plan = getPlan('community')!;
    expect(plan.monthlyPrice).toBe(0);
    expect(plan.yearlyPrice).toBe(0);
  });

  it('professional plan monthly price is $49', () => {
    const plan = getPlan('professional')!;
    expect(plan.monthlyPrice).toBe(4900);
  });

  it('professional plan yearly price is $490', () => {
    const plan = getPlan('professional')!;
    expect(plan.yearlyPrice).toBe(49000);
  });

  it('enterprise plan has unlimited agents', () => {
    const plan = getPlan('enterprise')!;
    expect(plan.maxAgents).toBeNull();
    expect(plan.maxConnectors).toBeNull();
    expect(plan.maxWorkflows).toBeNull();
    expect(plan.maxUsers).toBeNull();
    expect(plan.aiCredits).toBeNull();
  });

  it('community plan has hard limits', () => {
    const plan = getPlan('community')!;
    expect(plan.maxAgents).toBe(1);
    expect(plan.maxConnectors).toBe(2);
    expect(plan.maxWorkflows).toBe(5);
    expect(plan.maxUsers).toBe(2);
  });

  it('getPlan returns undefined for unknown slug', () => {
    // @ts-expect-error — intentional unknown slug
    expect(getPlan('unknown')).toBeUndefined();
  });

  it('getPlanById returns the correct plan', () => {
    const plan = getPlanById('plan-enterprise');
    expect(plan?.slug).toBe('enterprise');
  });

  it('listPlans returns all 3 plans', () => {
    expect(listPlans()).toHaveLength(3);
  });

  it('enterprise has dedicated support', () => {
    expect(getPlan('enterprise')!.supportLevel).toBe('dedicated');
  });

  it('community rate limit is 100 req/min', () => {
    expect(getPlan('community')!.rateLimit).toBe(100);
  });

  it('professional rate limit is 500 req/min', () => {
    expect(getPlan('professional')!.rateLimit).toBe(500);
  });
});
