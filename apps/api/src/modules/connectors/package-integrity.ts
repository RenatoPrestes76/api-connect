import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const PACKAGE_SECRET =
  process.env['CONNECTOR_PACKAGE_SECRET'] ?? 'atlas-connector-package-dev-secret-change-in-prod';

/**
 * This backend is the registry, not a package host — there are no real
 * package bytes to hash. The checksum instead covers the version's own
 * descriptive fields, so it's still a real, stable, tamper-evident value a
 * Runtime can compare against what it actually received.
 */
export function computeChecksum(input: {
  connectorId: string;
  version: string;
  changelog: string;
  dependencies: string[];
}): string {
  const canonical = JSON.stringify({
    connectorId: input.connectorId,
    version: input.version,
    changelog: input.changelog,
    dependencies: [...input.dependencies].sort(),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Signs (connectorId, version, checksum) with HMAC-SHA256 so installers can
 * reject anything not issued by this registry. Synchronous by design —
 * publishVersion() runs inside ConnectorsStore's constructor (seed data),
 * which can't await.
 */
export function signPackage(input: {
  connectorId: string;
  version: string;
  checksum: string;
}): string {
  const payload = `${input.connectorId}:${input.version}:${input.checksum}`;
  const mac = createHmac('sha256', PACKAGE_SECRET).update(payload).digest('hex');
  return `${Buffer.from(payload).toString('base64url')}.${mac}`;
}

export interface VerifiedPackage {
  connectorId: string;
  version: string;
  checksum: string;
}

/** Verifies a package signature and returns the claims it commits to, or null if invalid/tampered/unsigned. */
export function verifyPackageSignature(signature: string): VerifiedPackage | null {
  const [encodedPayload, mac] = signature.split('.');
  if (!encodedPayload || !mac) return null;

  let payload: string;
  try {
    payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const expectedMac = createHmac('sha256', PACKAGE_SECRET).update(payload).digest('hex');
  const macBuf = Buffer.from(mac);
  const expectedBuf = Buffer.from(expectedMac);
  if (macBuf.length !== expectedBuf.length || !timingSafeEqual(macBuf, expectedBuf)) {
    return null;
  }

  const [connectorId, version, checksum] = payload.split(':');
  if (!connectorId || !version || !checksum) return null;
  return { connectorId, version, checksum };
}
