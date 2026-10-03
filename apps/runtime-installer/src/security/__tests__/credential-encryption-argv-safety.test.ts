import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocked in this file only (not the sibling credential-encryption.test.ts,
// which needs the real PowerShell/DPAPI round trip) — isolates the mock so
// it can't accidentally swallow the real-DPAPI proof elsewhere.
vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));

const SECRET = 'rt_token_SHOULD_NEVER_APPEAR_IN_ARGV';

describe('DPAPI never passes the secret as a PowerShell command-line argument', () => {
  beforeEach(async () => {
    vi.resetModules();
    const { execFileSync } = await import('node:child_process');
    vi.mocked(execFileSync).mockClear();
  });

  it('dpapiProtect sends the plaintext via stdin, not argv', async () => {
    const { execFileSync } = await import('node:child_process');
    vi.mocked(execFileSync).mockReturnValue(Buffer.from(SECRET, 'utf-8').toString('base64'));

    const { _internal } = await import('../credential-encryption.js');
    _internal.dpapiProtect(Buffer.from(SECRET, 'utf-8'));

    expect(execFileSync).toHaveBeenCalledTimes(1);
    const [, args, options] = vi.mocked(execFileSync).mock.calls[0]!;
    for (const arg of args as string[]) {
      expect(arg).not.toContain(SECRET);
      expect(arg).not.toContain(Buffer.from(SECRET, 'utf-8').toString('base64'));
    }
    expect((options as { input?: string }).input).toContain(
      Buffer.from(SECRET, 'utf-8').toString('base64')
    );
  });

  it('dpapiUnprotect sends the ciphertext via stdin, not argv', async () => {
    const { execFileSync } = await import('node:child_process');
    const fakeCiphertextB64 = Buffer.from('fake-ciphertext-bytes', 'utf-8').toString('base64');
    vi.mocked(execFileSync).mockReturnValue(Buffer.from(SECRET, 'utf-8').toString('base64'));

    const { _internal } = await import('../credential-encryption.js');
    _internal.dpapiUnprotect(Buffer.from(fakeCiphertextB64, 'base64'));

    expect(execFileSync).toHaveBeenCalledTimes(1);
    const [, args, options] = vi.mocked(execFileSync).mock.calls[0]!;
    for (const arg of args as string[]) {
      expect(arg).not.toContain(fakeCiphertextB64);
    }
    expect((options as { input?: string }).input).toBe(fakeCiphertextB64);
  });

  it('uses DataProtectionScope.LocalMachine, not CurrentUser', async () => {
    const { _internal } = await import('../credential-encryption.js');
    expect(_internal.DPAPI_SCOPE).toBe('LocalMachine');
  });
});
