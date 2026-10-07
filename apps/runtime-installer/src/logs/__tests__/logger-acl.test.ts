import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Logger } from '../logger.js';

/**
 * Separate from logger.test.ts on purpose: that suite mocks
 * restrictDirectoryToSystemAndAdministrators away (it's about log-line
 * redaction, not ACL enforcement — and proving the ACL for real requires
 * writing into the now-restricted directory afterwards, which an
 * unprivileged test account genuinely cannot do, same UAC-filtered-token
 * behavior documented throughout this repo's other *-acl.test.ts files).
 * This file is the real, non-mocked proof.
 */

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-logger-acl-test-'));
  dirs.push(dir);
  return dir;
}

function aclSids(path: string): string[] {
  const output = execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `(Get-Acl '${path}').Access | ForEach-Object { $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value }`,
    ],
    { encoding: 'utf-8' }
  );
  return output.trim().split(/\r?\n/).filter(Boolean);
}

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop();
    if (dir) {
      try {
        execFileSync('icacls.exe', [dir, '/reset', '/t', '/c', '/q'], { stdio: 'ignore' });
      } catch {
        /* best-effort */
      }
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe.skipIf(process.platform !== 'win32')('Logger ACL (Windows only, real icacls)', () => {
  it('restricts the log directory to SYSTEM + Administrators', async () => {
    const dir = tempDir();
    const logger = new Logger(dir);

    const dirSids = aclSids(dir);
    expect(dirSids).toContain('S-1-5-18');
    expect(dirSids).toContain('S-1-5-32-544');
    expect(dirSids).toHaveLength(2);

    await logger.close();
  });

  it('grants with (OI)(CI) so files created inside later inherit the same restriction automatically', async () => {
    const dir = tempDir();
    const logger = new Logger(dir);

    // Verified structurally via icacls's own flags, not by creating a
    // file as this (unprivileged) test process — exactly the real
    // scenario this restriction defends against: an unprivileged account
    // can no longer write into this directory at all, which is also why
    // this can't be proven by writing a file from this same test.
    const raw = execFileSync('icacls.exe', [dir], { encoding: 'utf-8' });
    expect(raw).toContain('(OI)(CI)(F)');

    await logger.close();
  });
});
