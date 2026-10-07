import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { OfflineQueue } from '../offline-queue.js';

/**
 * Separate from offline-queue.test.ts on purpose: that suite mocks
 * restrictToSystemAndAdministrators away (it's about persistence logic,
 * not ACL enforcement, and several of its tests open the same file twice
 * in one unprivileged test process, which the real ACL would block). This
 * file is the real, non-mocked proof — same pattern as security/
 * __tests__/credential-encryption.test.ts's identity.json ACL test.
 */

const dirs: string[] = [];
function tempQueuePath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-offline-queue-acl-test-'));
  dirs.push(dir);
  return join(dir, 'queue.sqlite');
}

function aclSids(filePath: string): string[] {
  const output = execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `(Get-Acl '${filePath}').Access | ForEach-Object { $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value }`,
    ],
    { encoding: 'utf-8' }
  );
  return output.trim().split(/\r?\n/).filter(Boolean);
}

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop();
    if (dir) {
      if (process.platform === 'win32') {
        // Restore this (unprivileged) test account's own access before
        // rmSync — see windows-acl-test-cleanup.ts's doc comment for why
        // the real ACL would otherwise block its own cleanup.
        try {
          execFileSync('icacls.exe', [dir, '/reset', '/t', '/c', '/q'], { stdio: 'ignore' });
        } catch {
          /* best-effort */
        }
      }
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe.skipIf(process.platform !== 'win32')(
  'OfflineQueue ACL (Windows only, real icacls)',
  () => {
    it('restricts the .sqlite file and its -wal/-shm siblings to SYSTEM + Administrators', () => {
      const path = tempQueuePath();
      const queue = new OfflineQueue(path);
      queue.enqueue({ requestId: 'req_1', runtimeId: 'rt_1', success: true, schema: {} });

      expect(existsSync(path)).toBe(true);
      expect(existsSync(path + '-wal')).toBe(true);
      expect(existsSync(path + '-shm')).toBe(true);

      for (const suffix of ['', '-wal', '-shm']) {
        const sids = aclSids(path + suffix);
        expect(sids).toContain('S-1-5-18'); // SYSTEM
        expect(sids).toContain('S-1-5-32-544'); // Administrators
        expect(sids).toHaveLength(2);
      }

      queue.close();
    });
  }
);
