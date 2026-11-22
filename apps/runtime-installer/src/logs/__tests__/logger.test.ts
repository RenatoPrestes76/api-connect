import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// This suite is about log-line redaction (_sanitize), not ACL
// enforcement — the real, non-mocked ACL proof lives in
// logger-acl.test.ts. Writing a log line here means writing into the
// directory right after construction; the real ACL would do exactly
// what it's supposed to (block an unprivileged account, which this test
// process is), so it's mocked away here, same pattern as this repo's
// other *.test.ts/*-acl.test.ts splits (offline-queue, run/daemon).
vi.mock('../../security/credential-encryption.js', async () => {
  const actual = await vi.importActual<typeof import('../../security/credential-encryption.js')>(
    '../../security/credential-encryption.js'
  );
  return { ...actual, restrictDirectoryToSystemAndAdministrators: () => {} };
});

import { Logger } from '../logger.js';

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-logger-test-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('Logger.close', () => {
  it('returns a real Promise that only resolves once the stream has actually finished flushing to disk — close() used to be void/fire-and-forget, which could lose the last line if the process exited right after calling it', async () => {
    const dir = tempDir();
    const logger = new Logger(dir);
    logger.info('installer.log', 'line before close');

    const result = logger.close();
    expect(result).toBeInstanceOf(Promise);
    await result;

    const raw = readFileSync(join(dir, 'installer.log'), 'utf-8');
    expect(raw).toContain('line before close');
  });
});

describe('Logger._sanitize', () => {
  it('redacts a password field before it ever reaches disk', async () => {
    const dir = tempDir();
    const logger = new Logger(dir);
    logger.info('installer.log', JSON.stringify({ host: 'db.local', password: 'super-secret-pw' }));
    await logger.close();
    const raw = readFileSync(join(dir, 'installer.log'), 'utf-8');
    expect(raw).not.toContain('super-secret-pw');
    expect(raw).toContain('"password":"[REDACTED]"');
  });

  it('redacts atlasActivationKey / activationKey fields', async () => {
    const dir = tempDir();
    const logger = new Logger(dir);
    logger.info('installer.log', JSON.stringify({ atlasActivationKey: 'ATLAS-SECRET-VALUE' }));
    await logger.close();
    const raw = readFileSync(join(dir, 'installer.log'), 'utf-8');
    expect(raw).not.toContain('ATLAS-SECRET-VALUE');
  });

  it('redacts the credential portion of a connection-string-shaped value', async () => {
    const dir = tempDir();
    const logger = new Logger(dir);
    logger.info(
      'installer.log',
      'connection failed: postgresql://atlas_readonly:hunter2@10.0.2.2:5434/erp'
    );
    await logger.close();
    const raw = readFileSync(join(dir, 'installer.log'), 'utf-8');
    expect(raw).not.toContain('hunter2');
    expect(raw).toContain('postgresql://***:***@10.0.2.2:5434/erp');
  });

  it('redacts the legacy ATLAS-XXXX-XXXX-XXXX activation-token shape', async () => {
    const dir = tempDir();
    const logger = new Logger(dir);
    logger.info('installer.log', 'token was ATLAS-AB12-CD34-EF56');
    await logger.close();
    const raw = readFileSync(join(dir, 'installer.log'), 'utf-8');
    expect(raw).not.toContain('ATLAS-AB12-CD34-EF56');
  });
});
