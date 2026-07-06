import { postJson } from '../utils/http-client.js';

export interface VersionCheckResult {
  current:     string;
  latest:      string;
  updateAvailable: boolean;
  releaseUrl?:  string;
}

interface VersionResponse {
  version:    string;
  releaseUrl?: string;
}

export async function checkForUpdates(
  apiBaseUrl:      string,
  currentVersion:  string,
): Promise<VersionCheckResult | null> {
  try {
    const url    = `${apiBaseUrl.replace(/\/$/, '')}/api/v1/installer/version`;
    const latest = await postJson<{ currentVersion: string }, VersionResponse>(url, { currentVersion });
    return {
      current:         currentVersion,
      latest:          latest.version,
      updateAvailable: isNewer(latest.version, currentVersion),
      releaseUrl:      latest.releaseUrl,
    };
  } catch {
    // Version check is non-critical — silently skip if the endpoint is unavailable
    return null;
  }
}

/** Returns true if `candidate` is strictly newer than `base` (basic semver comparison). */
function isNewer(candidate: string, base: string): boolean {
  const parse = (v: string): [number, number, number] => {
    const parts = v.replace(/^v/, '').split('.').map(Number);
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  };
  const [cMaj, cMin, cPat] = parse(candidate);
  const [bMaj, bMin, bPat] = parse(base);
  if (cMaj !== bMaj) return cMaj > bMaj;
  if (cMin !== bMin) return cMin > bMin;
  return cPat > bPat;
}
