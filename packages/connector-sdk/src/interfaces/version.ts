export interface VersionRange {
  readonly min: string;
  readonly max?: string;
}

/** Compare two semver strings. Returns -1, 0, or 1. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const parse = (v: string): [number, number, number] => {
    const parts = v.replace(/^v/, '').split('.').map(Number);
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  };
  const [aMaj, aMin, aPat] = parse(a);
  const [bMaj, bMin, bPat] = parse(b);
  if (aMaj !== bMaj) return aMaj > bMaj ? 1 : -1;
  if (aMin !== bMin) return aMin > bMin ? 1 : -1;
  if (aPat !== bPat) return aPat > bPat ? 1 : -1;
  return 0;
}

/** Returns true if `version` satisfies the given range (inclusive min, exclusive max). */
export function satisfiesRange(version: string, range: VersionRange): boolean {
  if (compareVersions(version, range.min) < 0) return false;
  if (range.max !== undefined && compareVersions(version, range.max) >= 0) return false;
  return true;
}

/** Returns true if `version` is a valid semver string (major.minor.patch). */
export function isValidVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(version.replace(/^v/, ''));
}
