import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const SERVICE_NAME = 'atlas-runtime';
const UNIT_PATH = `/etc/systemd/system/${SERVICE_NAME}.service`;

export interface LinuxServiceOptions {
  runtimeRoot: string;
  autoStart: boolean;
  user?: string;
}

export function installLinuxService(opts: LinuxServiceOptions): void {
  const binPath = path.join(opts.runtimeRoot, 'atlas-runtime');
  const unit = buildUnitFile(binPath, opts.runtimeRoot, opts.user);

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

function buildUnitFile(binPath: string, runtimeRoot: string, user?: string): string {
  const userLine = user ? `User=${user}\n` : '';
  return (
    [
      '[Unit]',
      'Description=Seltriva Atlas Runtime Agent',
      'After=network-online.target',
      'Wants=network-online.target',
      '',
      '[Service]',
      'Type=simple',
      `ExecStart=${binPath}`,
      `WorkingDirectory=${runtimeRoot}`,
      userLine.trimEnd(),
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
