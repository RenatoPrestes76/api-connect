import { describe, it, expect, beforeEach } from 'vitest';
import { ReleaseChecklistRunner, CHECKLIST_TOTAL, BLOCKER_COUNT } from '../checklist.js';

describe('ReleaseChecklistRunner — construction', () => {
  it('initializes all items as pending', () => {
    const runner = new ReleaseChecklistRunner();
    const items = runner.list();
    expect(items.length).toBe(CHECKLIST_TOTAL);
    expect(items.every((i) => i.status === 'pending')).toBe(true);
  });

  it('CHECKLIST_TOTAL is at least 40', () => {
    expect(CHECKLIST_TOTAL).toBeGreaterThanOrEqual(40);
  });

  it('BLOCKER_COUNT is at least 15', () => {
    expect(BLOCKER_COUNT).toBeGreaterThanOrEqual(15);
  });

  it('all items have required fields', () => {
    const runner = new ReleaseChecklistRunner();
    for (const item of runner.list()) {
      expect(item.id).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(item.label).toBeTruthy();
      expect(typeof item.blocksRelease).toBe('boolean');
    }
  });
});

describe('ReleaseChecklistRunner — mark', () => {
  let runner: ReleaseChecklistRunner;
  beforeEach(() => {
    runner = new ReleaseChecklistRunner();
  });

  it('marks an item as passed', () => {
    const result = runner.mark('prod-001', 'passed', { checkedBy: 'ci' });
    expect(result).not.toBeNull();
    expect(result!.status).toBe('passed');
    expect(result!.checkedBy).toBe('ci');
    expect(result!.checkedAt).not.toBeNull();
  });

  it('marks an item as failed with notes', () => {
    const result = runner.mark('sec-001', 'failed', { notes: 'Critical CVE found' });
    expect(result!.status).toBe('failed');
    expect(result!.notes).toBe('Critical CVE found');
  });

  it('returns null for unknown id', () => {
    expect(runner.mark('no-such', 'passed')).toBeNull();
  });

  it('marks all items at once', () => {
    runner.markAll('passed', 'qa-team');
    const items = runner.list();
    expect(items.every((i) => i.status === 'passed')).toBe(true);
    expect(items.every((i) => i.checkedBy === 'qa-team')).toBe(true);
  });
});

describe('ReleaseChecklistRunner — summarize', () => {
  let runner: ReleaseChecklistRunner;
  beforeEach(() => {
    runner = new ReleaseChecklistRunner();
  });

  it('fresh runner is not ready for release', () => {
    const summary = runner.summarize();
    expect(summary.readyForRelease).toBe(false);
    expect(summary.pending).toBe(CHECKLIST_TOTAL);
  });

  it('readyForRelease is true when all items passed', () => {
    runner.markAll('passed');
    expect(runner.summarize().readyForRelease).toBe(true);
  });

  it('readyForRelease is false with any blocker failed', () => {
    runner.markAll('passed');
    runner.mark('prod-001', 'failed');
    const summary = runner.summarize();
    expect(summary.blockers).toBe(1);
    expect(summary.readyForRelease).toBe(false);
  });

  it('skipped items count toward passed in readiness', () => {
    runner.markAll('skipped');
    const summary = runner.summarize();
    expect(summary.skipped).toBe(CHECKLIST_TOTAL);
    expect(summary.readyForRelease).toBe(true);
  });

  it('byCategory totals match list length', () => {
    const summary = runner.summarize();
    const catTotal = Object.values(summary.byCategory).reduce((s, v) => s + v.total, 0);
    expect(catTotal).toBe(CHECKLIST_TOTAL);
  });
});

describe('ReleaseChecklistRunner — reset', () => {
  it('reset clears all statuses back to pending', () => {
    const runner = new ReleaseChecklistRunner();
    runner.markAll('passed');
    runner.reset();
    expect(runner.list().every((i) => i.status === 'pending')).toBe(true);
  });
});
