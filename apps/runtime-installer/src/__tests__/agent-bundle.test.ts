import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installAgentBundle, AgentBundleNotFoundError } from '../agent-bundle.js';

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-agent-bundle-test-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('installAgentBundle', () => {
  it('throws AgentBundleNotFoundError, naming the expected path, when no bundle ships alongside the installer', () => {
    // bundledAgentSourceDir() resolves relative to this module's own
    // location, which — run from source (not a scripts/package-
    // runtime.mjs distributable) — never has a sibling "agent" directory.
    // This exercises the real, intentional failure path: refuse loudly
    // rather than silently install nothing.
    const runtimeRoot = tempDir();
    expect(() => installAgentBundle(runtimeRoot)).toThrow(AgentBundleNotFoundError);
    expect(() => installAgentBundle(runtimeRoot)).toThrow(/Agent bundle not found at/);
  });
});
