import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../windows-service.js', () => ({
  installWindowsService: vi.fn().mockResolvedValue(undefined),
  uninstallWindowsService: vi.fn().mockResolvedValue(undefined),
  startWindowsService: vi.fn(),
  stopWindowsService: vi.fn(),
  windowsServiceExists: vi.fn().mockReturnValue(true),
}));
vi.mock('../linux-service.js', () => ({
  installLinuxService: vi.fn(),
  uninstallLinuxService: vi.fn(),
  startLinuxService: vi.fn(),
  stopLinuxService: vi.fn(),
  linuxServiceExists: vi.fn().mockReturnValue(true),
}));

import { ServiceManager } from '../service-manager.js';
import * as windows from '../windows-service.js';
import * as linux from '../linux-service.js';

afterEach(() => {
  vi.clearAllMocks();
});

const OPTS = {
  runtimeRoot: '/opt/atlas',
  autoStart: true,
  scriptPath: '/opt/atlas/agent/dist/cli/bin.js',
  env: { ATLAS_API_URL: 'https://x' },
};

describe('ServiceManager — platform dispatch', () => {
  it('routes install() to the Windows implementation on windows', async () => {
    await new ServiceManager('windows').install(OPTS);
    expect(windows.installWindowsService).toHaveBeenCalledWith(OPTS);
    expect(linux.installLinuxService).not.toHaveBeenCalled();
  });

  it('routes install() to the Linux implementation on linux', async () => {
    await new ServiceManager('linux').install(OPTS);
    expect(linux.installLinuxService).toHaveBeenCalledWith(OPTS);
    expect(windows.installWindowsService).not.toHaveBeenCalled();
  });

  it('throws for an unsupported platform instead of silently no-op-ing', async () => {
    await expect(new ServiceManager('macos').install(OPTS)).rejects.toThrow(/not supported/);
  });

  it('routes uninstall() per platform, passing scriptPath through for Windows', async () => {
    await new ServiceManager('windows').uninstall({ scriptPath: OPTS.scriptPath });
    expect(windows.uninstallWindowsService).toHaveBeenCalledWith({ scriptPath: OPTS.scriptPath });

    await new ServiceManager('linux').uninstall({ scriptPath: OPTS.scriptPath });
    expect(linux.uninstallLinuxService).toHaveBeenCalled();
  });

  it('routes start/stop/exists per platform', () => {
    const win = new ServiceManager('windows');
    win.start();
    win.stop();
    expect(win.exists()).toBe(true);
    expect(windows.startWindowsService).toHaveBeenCalled();
    expect(windows.stopWindowsService).toHaveBeenCalled();
    expect(windows.windowsServiceExists).toHaveBeenCalled();
  });

  it('exists() returns false for an unsupported platform rather than throwing', () => {
    expect(new ServiceManager('macos').exists()).toBe(false);
  });
});
