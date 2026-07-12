import { randomBytes, createHmac } from 'node:crypto';

// ─── Base32 ───────────────────────────────────────────────────────────────────

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(str: string): Buffer {
  const cleaned = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of cleaned) {
    const idx = BASE32.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// ─── HOTP (RFC 4226) ──────────────────────────────────────────────────────────

function hotp(secret: Buffer, counter: number, digits = 6): number {
  const buf = Buffer.allocUnsafe(8);
  // Write 8-byte big-endian counter
  const hi = Math.floor(counter / 0x100000000);
  const lo = counter >>> 0;
  buf.writeUInt32BE(hi, 0);
  buf.writeUInt32BE(lo, 4);

  const mac = createHmac('sha1', secret).update(buf).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const code =
    ((mac[offset]! & 0x7f) << 24) |
    ((mac[offset + 1]! & 0xff) << 16) |
    ((mac[offset + 2]! & 0xff) << 8) |
    (mac[offset + 3]! & 0xff);
  return code % 10 ** digits;
}

// ─── TOTP (RFC 6238) ──────────────────────────────────────────────────────────

const PERIOD = 30;
const DIGITS = 6;

/**
 * Generates a TOTP token.
 * @param secret - raw secret bytes
 * @param timeMs - unix milliseconds (defaults to Date.now())
 */
export function generateTotpToken(secret: Buffer, timeMs?: number): string {
  const T = Math.floor((timeMs ?? Date.now()) / 1000 / PERIOD);
  const code = hotp(secret, T, DIGITS);
  return String(code).padStart(DIGITS, '0');
}

/**
 * Verifies a TOTP token with a time window.
 * Accepts tokens from [T - windows, T + windows].
 */
export function verifyTotpToken(
  secret: Buffer,
  token: string,
  timeMs?: number,
  windows = 1
): boolean {
  const code = parseInt(token, 10);
  if (isNaN(code) || code < 0 || code > 999_999) return false;
  const T = Math.floor((timeMs ?? Date.now()) / 1000 / PERIOD);
  for (let w = -windows; w <= windows; w++) {
    if (hotp(secret, T + w, DIGITS) === code) return true;
  }
  return false;
}

// ─── TOTP setup ───────────────────────────────────────────────────────────────

/** Generates a fresh 20-byte TOTP secret and returns it base32-encoded. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/**
 * Builds the otpauth:// URI for authenticator apps.
 * @param issuer  e.g. "Atlas Connect"
 * @param account e.g. "user@company.com"
 * @param secretBase32 base32-encoded secret
 */
export function buildOtpUri(issuer: string, account: string, secretBase32: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(PERIOD),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Generates a list of 8 one-time backup recovery codes. */
export function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(5);
    const hex = bytes.toString('hex').toUpperCase();
    return `${hex.slice(0, 5)}-${hex.slice(5)}`;
  });
}
