import { execFileSync } from 'node:child_process';

/**
 * `persistIdentity` (atlas-runtime-client/identity.ts) locks its file to
 * SYSTEM + Administrators only (see security/credential-encryption.ts's
 * `restrictToSystemAndAdministrators`) — correct in production, where the
 * Windows service always runs as the same account (LocalSystem by
 * default) across every call. Tests don't have that luxury: they run as
 * whatever unprivileged dev/CI account invoked vitest, so a temp dir that
 * went through `persistIdentity` is Windows-ACL-locked against that same
 * account by the time `rmSync` tries to clean it up, and fails with
 * EPERM. `/reset` restores the normal inherited ACL (the state before
 * any test touched it) without needing to know the caller's own SID —
 * NTFS lets a file's owner reset its own DACL regardless of what that
 * DACL currently allows. Call this right before `rmSync` on any temp dir
 * a test may have run `persistIdentity`/`loadOrCreateIdentity` against.
 */
export function restoreAclForCleanup(dirPath: string): void {
  if (process.platform !== 'win32') return;
  try {
    execFileSync('icacls.exe', [dirPath, '/reset', '/t', '/c', '/q'], { stdio: 'ignore' });
  } catch {
    // best-effort — if this fails, the subsequent rmSync will surface it.
  }
}
