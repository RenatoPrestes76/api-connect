import { describe, it, expect } from 'vitest';
import { ChangelogManager, CHANGELOG } from '../changelog.js';

describe('CHANGELOG data', () => {
  it('has entries for all 37 sprints', () => {
    const sprints = new Set(CHANGELOG.map((v) => v.sprint));
    expect(sprints.has(1)).toBe(true);
    expect(sprints.has(37)).toBe(true);
  });

  it('version 1.0.0 is the GA release', () => {
    const ga = CHANGELOG.find((v) => v.version === '1.0.0');
    expect(ga).toBeDefined();
    expect(ga!.codename).toBe('ODYSSEY');
    expect(ga!.sprint).toBe(37);
  });

  it('all entries have required fields', () => {
    for (const version of CHANGELOG) {
      expect(version.version).toBeTruthy();
      expect(version.codename).toBeTruthy();
      for (const entry of version.entries) {
        expect(entry.id).toBeTruthy();
        expect(entry.type).toBeTruthy();
        expect(entry.description).toBeTruthy();
        expect(entry.component).toBeTruthy();
      }
    }
  });
});

describe('ChangelogManager', () => {
  const mgr = new ChangelogManager();

  it('list() returns versions in descending order', () => {
    const versions = mgr.list();
    expect(versions[0]!.version).toBe('1.0.0');
  });

  it('get() returns the specific version', () => {
    const v = mgr.get('1.0.0');
    expect(v).toBeDefined();
    expect(v!.codename).toBe('ODYSSEY');
  });

  it('get() returns undefined for unknown version', () => {
    expect(mgr.get('99.0.0')).toBeUndefined();
  });

  it('getBySprint() returns the correct version', () => {
    const v = mgr.getBySprint(36);
    expect(v).toBeDefined();
    expect(v!.codename).toBe('TITAN');
  });

  it('getLatest() returns 1.0.0', () => {
    expect(mgr.getLatest().version).toBe('1.0.0');
  });

  it('search() finds by codename', () => {
    const results = mgr.search('AEGIS');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.codename).toBe('AEGIS');
  });

  it('search() finds by description keyword', () => {
    const results = mgr.search('circuit breaker');
    expect(results.length).toBeGreaterThan(0);
  });

  it('entriesByType() returns only feat entries', () => {
    const entries = mgr.entriesByType('feat');
    expect(entries.every((e) => e.type === 'feat')).toBe(true);
    expect(entries.length).toBeGreaterThan(10);
  });
});
