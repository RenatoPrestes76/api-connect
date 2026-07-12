import { describe, it, expect } from 'vitest';
import { VersionManager, nextStage, isGa, stageLabel } from '../version.js';

describe('nextStage', () => {
  it('beta → rc1', () => {
    expect(nextStage('beta')).toBe('rc1');
  });
  it('rc1 → rc2', () => {
    expect(nextStage('rc1')).toBe('rc2');
  });
  it('rc2 → rc3', () => {
    expect(nextStage('rc2')).toBe('rc3');
  });
  it('rc3 → ga', () => {
    expect(nextStage('rc3')).toBe('ga');
  });
  it('ga → null (no next stage)', () => {
    expect(nextStage('ga')).toBeNull();
  });
});

describe('isGa', () => {
  it('returns true for ga', () => {
    expect(isGa('ga')).toBe(true);
  });
  it('returns false for rc3', () => {
    expect(isGa('rc3')).toBe(false);
  });
});

describe('stageLabel', () => {
  it('returns Portuguese label for each stage', () => {
    expect(stageLabel('beta')).toBe('Beta Fechado');
    expect(stageLabel('rc1')).toBe('Release Candidate 1');
    expect(stageLabel('ga')).toBe('General Availability');
  });
});

describe('VersionManager', () => {
  it('seed creates 5 versions (beta → ga)', () => {
    const mgr = new VersionManager();
    mgr.seed();
    expect(mgr.list().length).toBe(5);
  });

  it('latest() returns 1.0.0 after seed', () => {
    const mgr = new VersionManager();
    mgr.seed();
    expect(mgr.latest()?.version).toBe('1.0.0');
  });

  it('current() returns the GA version', () => {
    const mgr = new VersionManager();
    mgr.seed();
    expect(mgr.current()?.stage).toBe('ga');
  });

  it('get() returns a specific version', () => {
    const mgr = new VersionManager();
    mgr.seed();
    const v = mgr.get('1.0.0-rc1');
    expect(v).toBeDefined();
    expect(v!.stage).toBe('rc1');
  });

  it('get() returns undefined for unknown version', () => {
    const mgr = new VersionManager();
    expect(mgr.get('99.0.0')).toBeUndefined();
  });

  it('list() is sorted descending', () => {
    const mgr = new VersionManager();
    mgr.seed();
    const versions = mgr.list();
    expect(versions[0]!.version).toBe('1.0.0');
    expect(versions[versions.length - 1]!.version).toBe('1.0.0-beta');
  });

  it('certify() sets certifiedAt and certifiedBy', () => {
    const mgr = new VersionManager();
    mgr.seed();
    const certified = mgr.certify('1.0.0', 'qa-lead');
    expect(certified).not.toBeNull();
    expect(certified!.certifiedBy).toBe('qa-lead');
    expect(certified!.certifiedAt).not.toBeNull();
  });

  it('certify() returns null for unknown version', () => {
    const mgr = new VersionManager();
    expect(mgr.certify('0.0.0', 'qa')).toBeNull();
  });

  it('add() appends a new version', () => {
    const mgr = new VersionManager();
    mgr.seed();
    mgr.add({
      version: '1.0.1',
      stage: 'ga',
      buildNumber: 101,
      gitSha: 'abc123',
      releasedAt: null,
      certifiedAt: null,
      certifiedBy: null,
      notes: 'Patch release',
    });
    expect(mgr.list()[0]!.version).toBe('1.0.1');
  });
});
