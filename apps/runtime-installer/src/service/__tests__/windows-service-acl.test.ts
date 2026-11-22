import { describe, it, expect, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { installWindowsService, type WindowsServiceLib } from '../windows-service.js';

/**
 * Separate from windows-service.test.ts on purpose: that suite mocks
 * `node:child_process` wholesale (so it never shells out to a real
 * sc.exe), which incidentally also no-ops the icacls call this test
 * exists to prove for real. Uses a real temp directory as the fake
 * service's script path so the ACL call has a real `daemon/` directory
 * to act on, instead of the other suite's nonexistent fake path.
 */

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

function fakeLibEmittingInstall(): () => Promise<WindowsServiceLib> {
  return async () => ({
    Service: class extends EventEmitter {
      install() {
        this.emit('install');
      }
      uninstall() {
        this.emit('uninstall');
      }
    } as unknown as WindowsServiceLib['Service'],
  });
}

const dirs: string[] = [];
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

describe.skipIf(process.platform !== 'win32')(
  'installWindowsService ACL (Windows only, real icacls)',
  () => {
    it('restricts the generated daemon/ directory (XML + wrapper logs) to SYSTEM + Administrators', async () => {
      const root = mkdtempSync(join(tmpdir(), 'atlas-winsvc-acl-test-'));
      dirs.push(root);
      const scriptDir = join(root, 'agent', 'dist', 'cli');
      mkdirSync(scriptDir, { recursive: true });
      const scriptPath = join(scriptDir, 'bin.js');
      writeFileSync(scriptPath, '// fake entrypoint\n');
      // node-windows creates this itself on a real install; simulate it
      // since the fake Service below never really writes a wrapper.
      const daemonDir = join(scriptDir, 'daemon');
      mkdirSync(daemonDir, { recursive: true });

      await installWindowsService(
        {
          autoStart: true,
          scriptPath,
          env: { ATLAS_API_URL: 'https://x', ATLAS_ACTIVATION_KEY: 'super-secret' },
        },
        {
          loadLib: fakeLibEmittingInstall(),
          // The fake Service above never does a real sc.exe create, so the
          // real SCM-registration poll (see windows-service.ts's
          // waitForServiceRegistration) would never see the service appear.
          // This test only cares about the ACL side effect that follows it.
          exists: () => true,
        }
      );

      const sids = aclSids(daemonDir);
      expect(sids).toContain('S-1-5-18');
      expect(sids).toContain('S-1-5-32-544');
      expect(sids).toHaveLength(2);
    });
  }
);
