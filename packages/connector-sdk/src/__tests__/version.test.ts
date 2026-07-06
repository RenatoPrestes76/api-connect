import { describe, it, expect } from 'vitest';
import { compareVersions, satisfiesRange, isValidVersion } from '../interfaces/version.js';

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
  });

  it('returns 1 when a has higher major', () => {
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
  });

  it('returns -1 when a has lower major', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
  });

  it('compares minor version correctly', () => {
    expect(compareVersions('1.2.0', '1.1.9')).toBe(1);
    expect(compareVersions('1.1.0', '1.2.0')).toBe(-1);
  });

  it('compares patch version correctly', () => {
    expect(compareVersions('1.2.4', '1.2.3')).toBe(1);
    expect(compareVersions('1.2.3', '1.2.4')).toBe(-1);
  });

  it('handles v-prefixed versions', () => {
    expect(compareVersions('v1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('v2.0.0', 'v1.0.0')).toBe(1);
  });
});

describe('satisfiesRange', () => {
  it('satisfies when version equals min', () => {
    expect(satisfiesRange('1.0.0', { min: '1.0.0' })).toBe(true);
  });

  it('satisfies when version is greater than min', () => {
    expect(satisfiesRange('1.5.0', { min: '1.0.0' })).toBe(true);
  });

  it('does not satisfy when version is below min', () => {
    expect(satisfiesRange('0.9.0', { min: '1.0.0' })).toBe(false);
  });

  it('does not satisfy when version equals max (exclusive)', () => {
    expect(satisfiesRange('2.0.0', { min: '1.0.0', max: '2.0.0' })).toBe(false);
  });

  it('satisfies when below max', () => {
    expect(satisfiesRange('1.9.9', { min: '1.0.0', max: '2.0.0' })).toBe(true);
  });

  it('does not satisfy when above max', () => {
    expect(satisfiesRange('2.1.0', { min: '1.0.0', max: '2.0.0' })).toBe(false);
  });
});

describe('isValidVersion', () => {
  it('accepts standard semver', () => {
    expect(isValidVersion('1.0.0')).toBe(true);
    expect(isValidVersion('0.1.0')).toBe(true);
    expect(isValidVersion('10.20.30')).toBe(true);
  });

  it('accepts v-prefixed semver', () => {
    expect(isValidVersion('v1.2.3')).toBe(true);
  });

  it('rejects non-semver strings', () => {
    expect(isValidVersion('1.0')).toBe(false);
    expect(isValidVersion('latest')).toBe(false);
    expect(isValidVersion('')).toBe(false);
  });
});
