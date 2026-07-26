/** Semver-lite comparison — dotted numeric segments, no pre-release/build metadata support. */
export function isVersionAtLeast(version: string, minVersion: string): boolean {
  const a = version.split('.').map((n) => parseInt(n, 10) || 0);
  const b = minVersion.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return true;
}
