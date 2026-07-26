/** Minimum Runtime software version the Control Plane will provision — semver-lite, string comparison of dotted segments. */
export const MIN_RUNTIME_VERSION = '1.0.0';

/** Latest recommended Runtime version — installs below this are flagged via needsUpdate(), not rejected. */
export const RECOMMENDED_RUNTIME_VERSION = '1.2.0';

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

export function needsUpdate(version: string): boolean {
  return !isVersionAtLeast(version, RECOMMENDED_RUNTIME_VERSION);
}
