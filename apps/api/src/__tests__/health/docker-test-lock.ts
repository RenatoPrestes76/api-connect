import { mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LOCK_DIR = join(tmpdir(), 'atlas-46-32-docker-test.lock');
const STALE_AFTER_MS = 5 * 60_000; // a crashed holder should never wedge future runs forever

/**
 * ATLAS 46.32 — the health/ directory has several Docker-based integration
 * tests (db-real-outage-recovery, graceful-shutdown, production-fail-loud)
 * that each build/run/stop real containers against the one Docker daemon
 * on this machine. Vitest runs different test *files* concurrently by
 * default (different worker threads) — confirmed directly that running
 * these three together, unserialized, produces real Docker-daemon-level
 * flakiness under the resulting load (containers intermittently
 * "disappearing" mid-test, name conflicts surviving `rm -f`, healthchecks
 * timing out) that does not reproduce when each file runs alone. This is
 * a `fs.mkdirSync`-based mutex (directory creation is atomic — the
 * standard dependency-free primitive for this) so these files serialize
 * against each other regardless of which worker thread vitest puts them
 * in, without slowing down or affecting any other test file in the suite.
 */
export async function withDockerLock<T>(fn: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + 8 * 60_000;
  for (;;) {
    try {
      mkdirSync(LOCK_DIR);
      break;
    } catch {
      try {
        const age = Date.now() - statSync(LOCK_DIR).mtimeMs;
        if (age > STALE_AFTER_MS) {
          rmSync(LOCK_DIR, { recursive: true, force: true });
          continue;
        }
      } catch {
        // lock dir vanished between the failed mkdir and this stat — fine,
        // just retry the acquire below.
      }
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for the Docker test lock at ${LOCK_DIR}`);
      }
      await new Promise((r) => setTimeout(r, 1_000));
    }
  }

  try {
    return await fn();
  } finally {
    rmSync(LOCK_DIR, { recursive: true, force: true });
  }
}
