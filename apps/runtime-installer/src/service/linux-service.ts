import fs from 'node:fs';
import { execSync } from 'node:child_process';

const SERVICE_NAME = 'atlas-runtime';
const UNIT_PATH = `/etc/systemd/system/${SERVICE_NAME}.service`;

export interface LinuxServiceOptions {
  runtimeRoot: string;
  autoStart: boolean;
  user?: string;
  /** Absolute path to the agent's compiled daemon entrypoint — see config/directory-setup.ts's agentEntrypointPath(). */
  scriptPath: string;
  /** ATLAS_API_URL / ATLAS_ORGANIZATION_CODE / ATLAS_ACTIVATION_KEY / ATLAS_RUNTIME_DATA_DIR — see apps/agent/src/cli/bin.ts. */
  env: Record<string, string>;
}

export function installLinuxService(opts: LinuxServiceOptions): void {
  // `ExecStart` previously pointed at a literal `atlas-runtime` binary
  // that no build step in this repo ever produced (docs/ATLAS-AUDIT-
  // REPORT.md) — systemd execs this directly (unlike the Windows SCM, it
  // doesn't need the target to speak any special protocol), so pointing
  // it at the real Node entrypoint is enough to make this genuinely work.
  const unit = buildUnitFile(
    process.execPath,
    opts.scriptPath,
    opts.runtimeRoot,
    opts.env,
    opts.user
  );

  fs.writeFileSync(UNIT_PATH, unit, { encoding: 'utf8', mode: 0o644 });
  execSync('systemctl daemon-reload', { stdio: 'pipe' });

  if (opts.autoStart) {
    execSync(`systemctl enable ${SERVICE_NAME}`, { stdio: 'pipe' });
  }
}

export function startLinuxService(): void {
  execSync(`systemctl start ${SERVICE_NAME}`, { stdio: 'pipe' });
}

export function stopLinuxService(): void {
  try {
    execSync(`systemctl stop ${SERVICE_NAME}`, { stdio: 'pipe' });
  } catch {
    /* service may already be stopped */
  }
}

export function uninstallLinuxService(): void {
  stopLinuxService();
  try {
    execSync(`systemctl disable ${SERVICE_NAME}`, { stdio: 'pipe' });
  } catch {
    /* may not be enabled */
  }
  if (fs.existsSync(UNIT_PATH)) fs.unlinkSync(UNIT_PATH);
  try {
    execSync('systemctl daemon-reload', { stdio: 'pipe' });
  } catch {
    /* best-effort */
  }
}

export function linuxServiceExists(): boolean {
  return fs.existsSync(UNIT_PATH);
}

function buildUnitFile(
  nodeExecPath: string,
  scriptPath: string,
  runtimeRoot: string,
  env: Record<string, string>,
  user?: string
): string {
  const userLine = user ? `User=${user}\n` : '';
  // systemd needs one Environment= per variable — a single `export`-
  // style line isn't supported by this directive.
  const envLines = Object.entries(env)
    .map(([name, value]) => `Environment=${name}=${value}`)
    .join('\n');
  return (
    [
      '[Unit]',
      'Description=Seltriva Atlas Runtime Agent',
      'After=network-online.target',
      'Wants=network-online.target',
      '',
      '[Service]',
      'Type=simple',
      `ExecStart=${nodeExecPath} ${scriptPath}`,
      `WorkingDirectory=${runtimeRoot}`,
      userLine.trimEnd(),
      envLines,
      'Restart=on-failure',
      'RestartSec=10s',
      'StandardOutput=append:/var/log/atlas-runtime.log',
      'StandardError=append:/var/log/atlas-runtime.log',
      '',
      '[Install]',
      'WantedBy=multi-user.target',
    ]
      .filter((line) => line !== undefined)
      .join('\n') + '\n'
  );
}
