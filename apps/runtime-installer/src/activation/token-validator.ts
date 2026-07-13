const TOKEN_REGEX = /^ATLAS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export function isValidTokenFormat(token: string): boolean {
  return TOKEN_REGEX.test(token.toUpperCase().trim());
}

export function normalizeToken(token: string): string {
  return token.toUpperCase().trim();
}

export class TokenFormatError extends Error {
  constructor(token: string) {
    super(
      `Invalid activation token format: "${token}"\n` +
        `Expected format: ATLAS-XXXX-XXXX-XXXX (uppercase alphanumeric segments)`
    );
    this.name = 'TokenFormatError';
  }
}
