import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { restrictDirectoryToSystemAndAdministrators } from '../security/credential-encryption.js';

const SERVICE_NAME = 'AtlasRuntime';
const SERVICE_DESCRIPTION = 'Seltriva Connect Atlas Runtime Agent — heartbeat and sync service.';

/**
 * The actual Windows service name registered with the SCM — NOT
 * `SERVICE_NAME`. `node-windows` derives its own internal `id` from
 * `name` via `name.replace(/[^\w]/gi, '').toLowerCase()`, then registers
 * the service under `<id>.exe` (see node-windows' daemon.js `id`/`_exe`
 * getters and `winsw.generateXml`'s `id: this._exe`) — there is no
 * constructor option to override this. Confirmed for real during the
 * Sprint A2.6 VM smoke test: `sc.exe start AtlasRuntime` always failed
 * with error 1060 ("service does not exist"), while `sc.exe start
 * atlasruntime.exe` worked immediately, every time — this naming
 * mismatch, not a timing race, was the actual root cause of what used to
 * look like an intermittent "freshly installed service sometimes rejects
 * sc.exe start" quirk. Every raw `sc.exe`/`net` call MUST target this
 * name, not `SERVICE_NAME`.
 */
const SERVICE_ID = `${SERVICE_NAME.replace(/[^\w]/gi, '').toLowerCase()}.exe`;

export interface WindowsServiceOptions {
  autoStart: boolean;
  /** Absolute path to the agent's compiled daemon entrypoint — see config/directory-setup.ts's agentEntrypointPath(). */
  scriptPath: string;
  /** ATLAS_API_URL / ATLAS_ORGANIZATION_CODE / ATLAS_ACTIVATION_KEY / ATLAS_RUNTIME_DATA_DIR — see apps/agent/src/cli/bin.ts. */
  env: Record<string, string>;
  /**
   * Absolute path to the bundled, checksum-verified node.exe this
   * installer ships with (see scripts/download-node-runtime.mjs) — the
   * wrapper execs THIS binary, not whatever (if anything) is on the
   * target machine's own PATH. Omit only for a dev/test install that
   * deliberately relies on a pre-installed system Node.
   */
  execPath?: string;
}

/** Minimal surface of `node-windows`'s `Service` actually used here — kept narrow so it's easy to fake in tests. */
export interface WindowsServiceLib {
  Service: new (opts: {
    name: string;
    description?: string;
    script: string;
    env?: Array<{ name: string; value: string }>;
    execPath?: string;
    maxRestarts?: number;
    wait?: number;
    grow?: number;
  }) => {
    install(): void;
    uninstall(): void;
    on(event: string, cb: (...args: unknown[]) => void): void;
  };
}

/**
 * node-windows' wrapper restarts the child `node <script>` process on
 * crash up to `maxRestarts` times, waiting `wait` seconds the first time
 * and growing that wait by `grow` (a fraction, e.g. 0.5 = +50%) each
 * subsequent restart. There is no literal "restart forever" option in
 * this library — 999 is a practical stand-in for "always restart" (no
 * realistic crash-loop scenario burns through 999 attempts before an
 * operator notices and intervenes).
 */
const RESTART_POLICY = { maxRestarts: 999, wait: 2, grow: 0.5 };

/**
 * Real Windows service registration via `node-windows`. A plain `sc.exe
 * create ... binPath=node.exe script.js` does NOT work: the Service
 * Control Manager requires the target binary to speak its own service
 * control protocol over a named pipe, which a bare Node process never
 * does — that's exactly why the previous version of this file (pointing
 * `binPath` at a literal `atlas-runtime.exe` that no build step in this
 * repo ever produced, see docs/ATLAS-AUDIT-REPORT.md) could never have
 * worked even if that file had existed. `node-windows` solves this by
 * generating a small, real wrapper executable that speaks that protocol
 * and spawns `node <script>` as its child, forwarding start/stop.
 *
 * `node-windows`'s own top-level module code throws immediately if
 * `require()`d on any OS other than Windows — and `service-manager.ts`
 * unconditionally loads both this file and `linux-service.ts` regardless
 * of platform — so the import here MUST stay dynamic (inside the
 * function, not a module-level `import`), or loading this module on
 * Linux would crash before `ServiceManager` ever checks the platform.
 */
async function loadNodeWindows(): Promise<WindowsServiceLib> {
  return (await import('node-windows')) as unknown as WindowsServiceLib;
}

function toEnvArray(env: Record<string, string>): Array<{ name: string; value: string }> {
  return Object.entries(env).map(([name, value]) => ({ name, value }));
}

/**
 * Where node-windows/WinSW writes the generated service wrapper — the
 * XML config (which carries ATLAS_ORGANIZATION_CODE/ATLAS_ACTIVATION_KEY
 * in plain text, since WinSW has no credential-encryption concept of its
 * own) and the wrapper's own `*.log` output. Confirmed by reading
 * node-windows' own lib/daemon.js (`this._directory = path.dirname(
 * config.script)`, `directory() { return path.join(this._directory,
 * 'daemon') }`), not guessed.
 */
function daemonDirFor(scriptPath: string): string {
  return join(dirname(scriptPath), 'daemon');
}

export async function installWindowsService(
  opts: WindowsServiceOptions,
  deps: { loadLib?: () => Promise<WindowsServiceLib> } = {}
): Promise<void> {
  const { Service } = await (deps.loadLib ?? loadNodeWindows)();
  const svc = new Service({
    name: SERVICE_NAME,
    description: SERVICE_DESCRIPTION,
    script: opts.scriptPath,
    env: toEnvArray(opts.env),
    execPath: opts.execPath,
    ...RESTART_POLICY,
  });

  await new Promise<void>((resolve, reject) => {
    svc.on('install', () => resolve());
    svc.on('alreadyinstalled', () => resolve());
    svc.on('invalidinstallation', () => reject(new Error('Invalid Windows service installation')));
    svc.on('error', (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))));
    svc.install();
  });

  // The XML this just wrote carries ATLAS_ACTIVATION_KEY in plain text
  // (see daemonDirFor's doc comment) — restricted the same as every
  // other sensitive file. Directory-level + inheritance so the wrapper's
  // own *.log files (written later, by the service's own account) are
  // covered too, with no per-file call needed.
  restrictDirectoryToSystemAndAdministrators(daemonDirFor(opts.scriptPath));

  if (!opts.autoStart) {
    // node-windows registers the service with automatic start by
    // default — demote it if the operator opted out during setup.
    execSync(`sc.exe config ${SERVICE_ID} start= demand`, { stdio: 'pipe' });
  }
}

/**
 * Stops the service BEFORE uninstalling it — node-windows' own
 * `svc.uninstall()` does not reliably do this itself. Confirmed for
 * real during the Sprint A2.6 VM smoke test: uninstalling a still-
 * running service correctly removed the SCM entry (`sc.exe query`
 * reported it gone), but the wrapper and daemon child processes were
 * BOTH still alive and running afterward, holding file locks on
 * `agent/node_modules/*` — which then made the NEXT install's own file
 * copy fail with "file already in use". Stopping first lets the
 * wrapper's own graceful shutdown (`wrapper.js`'s SIGTERM handler,
 * which kills its forked child) actually run before anything is torn
 * down from under it.
 */
export async function uninstallWindowsService(
  opts: { scriptPath: string },
  deps: { loadLib?: () => Promise<WindowsServiceLib>; sleep?: (ms: number) => Promise<void> } = {}
): Promise<void> {
  const sleep =
    deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  stopWindowsService();
  await sleep(3000);

  const { Service } = await (deps.loadLib ?? loadNodeWindows)();
  const svc = new Service({ name: SERVICE_NAME, script: opts.scriptPath });

  await new Promise<void>((resolve, reject) => {
    svc.on('uninstall', () => resolve());
    svc.on('alreadyuninstalled', () => resolve());
    svc.on('error', (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))));
    svc.uninstall();
  });
}

/**
 * What used to look like an intermittent "freshly created service
 * sometimes rejects sc.exe start" race (see git history for the long
 * version of that theory, ruled out piece by piece against a real VM
 * install) turned out, on closer inspection during the Sprint A2.6 VM
 * smoke test, to have a much simpler cause: every one of these calls was
 * targeting the WRONG service name (`SERVICE_NAME`/"AtlasRuntime")
 * instead of the one node-windows actually registers with the SCM
 * (`SERVICE_ID`/"atlasruntime.exe" — see that constant's doc comment).
 * `sc.exe start AtlasRuntime` fails with error 1060 ("service does not
 * exist") unconditionally, every time, regardless of timing — it was
 * never going to succeed no matter how long this retried. Retries are
 * kept as a small, cheap safety net for genuine transient SCM delays,
 * but the fix that actually matters is using the right name.
 */
export async function startWindowsService(
  deps: { sleep?: (ms: number) => Promise<void> } = {}
): Promise<void> {
  const sleep =
    deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const maxAttempts = 3;
  const delayMs = 2000;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      execSync(`sc.exe start ${SERVICE_ID}`, { stdio: 'pipe' });
      return;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) await sleep(delayMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function stopWindowsService(): void {
  try {
    execSync(`sc.exe stop ${SERVICE_ID}`, { stdio: 'pipe' });
  } catch {
    /* service may already be stopped */
  }
}

export function windowsServiceExists(): boolean {
  try {
    execSync(`sc.exe query ${SERVICE_ID}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
