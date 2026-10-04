/**
 * Copies the apps/agent standalone bundle (produced by `pnpm
 * --filter=@seltriva/agent deploy --prod <dir>` — see
 * scripts/package-runtime.mjs) into `<runtimeRoot>/agent`, so the
 * Windows service / systemd unit this installer registers has something
 * real to execute. Before this existed, the installer registered a
 * service pointing at a binary (`atlas-runtime.exe`) that no build step
 * in this repo ever produced (see docs/ATLAS-AUDIT-REPORT.md).
 *
 * This installer and the agent bundle are expected to ship side by side
 * in the distributable package: `<installer-root>/../agent` relative to
 * this installer's own deployed location (`dist/agent-bundle.js`'s
 * directory, two levels up from `dist/`). That layout is produced by
 * `scripts/package-runtime.mjs`, not invented ad hoc at install time.
 */
import { existsSync, mkdirSync, cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentBundleDir, runtimeNodeDir } from './config/directory-setup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** The bundled agent directory shipped alongside this installer's own deployed `dist/`. */
export function bundledAgentSourceDir(): string {
  return join(__dirname, '..', 'agent');
}

/** The pinned, checksummed `node.exe` shipped alongside this installer — see scripts/download-node-runtime.mjs. */
export function bundledNodeRuntimeSourceDir(): string {
  return join(__dirname, '..', 'runtime');
}

export class AgentBundleNotFoundError extends Error {
  constructor(sourceDir: string) {
    super(
      `Agent bundle not found at ${sourceDir} — this installer must be distributed together with ` +
        `a deployed apps/agent bundle (see scripts/package-runtime.mjs), not run from source alone.`
    );
  }
}

export class NodeRuntimeNotFoundError extends Error {
  constructor(sourceDir: string) {
    super(
      `Bundled node.exe not found at ${sourceDir} — this installer must be distributed together with ` +
        `the pinned Node runtime (see scripts/download-node-runtime.mjs), so the target machine never ` +
        `needs Node.js pre-installed.`
    );
  }
}

/** Copies the bundled agent into `<runtimeRoot>/agent`. Idempotent — safe to re-run (overwrites). */
export function installAgentBundle(runtimeRoot: string): void {
  const source = bundledAgentSourceDir();
  if (!existsSync(source)) {
    throw new AgentBundleNotFoundError(source);
  }
  const dest = agentBundleDir(runtimeRoot);
  mkdirSync(dest, { recursive: true });
  cpSync(source, dest, { recursive: true });
}

/**
 * Copies the bundled, checksum-verified `node.exe` into
 * `<runtimeRoot>/runtime` — the Windows service is configured to run
 * this exact binary (via `execPath`), never whatever (if anything) is on
 * the target machine's own PATH. Idempotent — safe to re-run.
 */
export function installNodeRuntime(runtimeRoot: string): void {
  const source = bundledNodeRuntimeSourceDir();
  if (!existsSync(join(source, 'node.exe'))) {
    throw new NodeRuntimeNotFoundError(source);
  }
  const dest = runtimeNodeDir(runtimeRoot);
  mkdirSync(dest, { recursive: true });
  cpSync(source, dest, { recursive: true });
}
