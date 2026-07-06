import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

/**
 * Writes a secret file with mode 0o600 (owner read/write only).
 * On Windows, we rely on NTFS ACLs applied via icacls as a best-effort step.
 */
export function writeSecretFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, { encoding: 'utf8', mode: 0o600 });

  if (process.platform === 'win32') {
    try {
      const username = process.env['USERNAME'] ?? process.env['USER'];
      if (username) {
        execSync(`icacls "${filePath}" /inheritance:r /grant "${username}:(R,W)"`, { stdio: 'ignore' });
      }
    } catch { /* best-effort — file is still owner-only on NTFS by default */ }
  }
}

export function readSecretFile(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

export function deleteSecretFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const size = fs.statSync(filePath).size;
  // Overwrite with zeros before deleting (basic secret hygiene)
  fs.writeFileSync(filePath, '\0'.repeat(size), 'utf8');
  fs.unlinkSync(filePath);
}
