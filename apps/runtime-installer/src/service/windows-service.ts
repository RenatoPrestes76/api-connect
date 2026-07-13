import { execSync } from 'node:child_process';
import path from 'node:path';

const SERVICE_NAME = 'AtlasRuntime';
const SERVICE_DISPLAY = 'Seltriva Atlas Runtime';
const SERVICE_DESCRIPTION = 'Seltriva Connect Atlas Runtime Agent — heartbeat and sync service.';

export interface WindowsServiceOptions {
  runtimeRoot: string;
  autoStart: boolean;
}

export function installWindowsService(opts: WindowsServiceOptions): void {
  const binPath = path.join(opts.runtimeRoot, 'atlas-runtime.exe');
  const startType = opts.autoStart ? 'auto' : 'demand';

  execSync(
    `sc.exe create ${SERVICE_NAME} ` +
      `binPath= "${binPath}" ` +
      `start= ${startType} ` +
      `DisplayName= "${SERVICE_DISPLAY}"`,
    { stdio: 'pipe' }
  );

  execSync(`sc.exe description ${SERVICE_NAME} "${SERVICE_DESCRIPTION}"`, { stdio: 'pipe' });
}

export function startWindowsService(): void {
  execSync(`sc.exe start ${SERVICE_NAME}`, { stdio: 'pipe' });
}

export function stopWindowsService(): void {
  try {
    execSync(`sc.exe stop ${SERVICE_NAME}`, { stdio: 'pipe' });
  } catch {
    /* service may already be stopped */
  }
}

export function uninstallWindowsService(): void {
  stopWindowsService();
  execSync(`sc.exe delete ${SERVICE_NAME}`, { stdio: 'pipe' });
}

export function windowsServiceExists(): boolean {
  try {
    execSync(`sc.exe query ${SERVICE_NAME}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
