import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';

// Mocked so these tests never shell out to a real sc.exe on the machine
// running them — installing/uninstalling a real Windows service is a
// persistent system change, never a side effect of a unit test.
vi.mock('node:child_process', () => ({ execSync: vi.fn() }));

import {
  installWindowsService,
  uninstallWindowsService,
  startWindowsService,
  stopWindowsService,
  windowsServiceExists,
  type WindowsServiceLib,
} from '../windows-service.js';

afterEach(() => {
  vi.clearAllMocks();
});

/** A fake node-windows Service that lets the test fire whichever event it wants, and records what it was constructed with. */
function fakeLib(
  behavior: (svc: EventEmitter & { install: () => void; uninstall: () => void }) => void,
  capturedOpts?: { value?: Record<string, unknown> }
): () => Promise<WindowsServiceLib> {
  return async () => ({
    Service: class extends EventEmitter {
      constructor(opts: Record<string, unknown>) {
        super();
        if (capturedOpts) capturedOpts.value = opts;
      }
      install() {
        behavior(this as never);
      }
      uninstall() {
        behavior(this as never);
      }
    } as unknown as WindowsServiceLib['Service'],
  });
}

describe('installWindowsService', () => {
  const opts = {
    autoStart: true,
    scriptPath: 'C:\\atlas\\agent\\dist\\cli\\bin.js',
    env: { ATLAS_API_URL: 'https://x' },
  };

  it('resolves when node-windows emits "install"', async () => {
    const loadLib = fakeLib((svc) => svc.emit('install'));
    await expect(installWindowsService(opts, { loadLib })).resolves.toBeUndefined();
  });

  it('resolves when node-windows emits "alreadyinstalled" (idempotent re-run)', async () => {
    const loadLib = fakeLib((svc) => svc.emit('alreadyinstalled'));
    await expect(installWindowsService(opts, { loadLib })).resolves.toBeUndefined();
  });

  it('passes execPath through to node-windows, so the service runs the bundled node.exe, not any system Node', async () => {
    const captured: { value?: Record<string, unknown> } = {};
    const loadLib = fakeLib((svc) => svc.emit('install'), captured);
    await installWindowsService({ ...opts, execPath: 'C:\\atlas\\runtime\\node.exe' }, { loadLib });
    expect(captured.value?.['execPath']).toBe('C:\\atlas\\runtime\\node.exe');
  });

  it('configures an auto-restart policy so the wrapper relaunches the daemon on crash', async () => {
    const captured: { value?: Record<string, unknown> } = {};
    const loadLib = fakeLib((svc) => svc.emit('install'), captured);
    await installWindowsService(opts, { loadLib });
    expect(captured.value?.['maxRestarts']).toBeGreaterThan(0);
    expect(captured.value?.['wait']).toBeGreaterThan(0);
    expect(captured.value?.['grow']).toBeGreaterThan(0);
  });

  it('rejects when node-windows emits "error"', async () => {
    const loadLib = fakeLib((svc) => svc.emit('error', new Error('access denied')));
    await expect(installWindowsService(opts, { loadLib })).rejects.toThrow('access denied');
  });

  it('rejects when node-windows emits "invalidinstallation"', async () => {
    const loadLib = fakeLib((svc) => svc.emit('invalidinstallation'));
    await expect(installWindowsService(opts, { loadLib })).rejects.toThrow();
  });

  it('demotes the service to manual start via sc.exe when autoStart is false', async () => {
    const { execSync } = await import('node:child_process');
    const loadLib = fakeLib((svc) => svc.emit('install'));
    await installWindowsService({ ...opts, autoStart: false }, { loadLib });
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('start= demand'),
      expect.anything()
    );
  });

  it('does not touch sc.exe start config when autoStart is true', async () => {
    const { execSync } = await import('node:child_process');
    const loadLib = fakeLib((svc) => svc.emit('install'));
    await installWindowsService({ ...opts, autoStart: true }, { loadLib });
    expect(execSync).not.toHaveBeenCalled();
  });
});

describe('uninstallWindowsService', () => {
  const noWait = { sleep: vi.fn().mockResolvedValue(undefined) };

  it('resolves when node-windows emits "uninstall"', async () => {
    const loadLib = fakeLib((svc) => svc.emit('uninstall'));
    await expect(
      uninstallWindowsService(
        { scriptPath: 'C:\\atlas\\agent\\dist\\cli\\bin.js' },
        { loadLib, ...noWait }
      )
    ).resolves.toBeUndefined();
  });

  it('resolves when node-windows emits "alreadyuninstalled"', async () => {
    const loadLib = fakeLib((svc) => svc.emit('alreadyuninstalled'));
    await expect(
      uninstallWindowsService(
        { scriptPath: 'C:\\atlas\\agent\\dist\\cli\\bin.js' },
        { loadLib, ...noWait }
      )
    ).resolves.toBeUndefined();
  });

  it('rejects when node-windows emits "error"', async () => {
    const loadLib = fakeLib((svc) => svc.emit('error', new Error('not found')));
    await expect(
      uninstallWindowsService(
        { scriptPath: 'C:\\atlas\\agent\\dist\\cli\\bin.js' },
        { loadLib, ...noWait }
      )
    ).rejects.toThrow('not found');
  });

  it('stops the service before uninstalling it — a still-running service otherwise leaves its processes alive, holding file locks (confirmed for real during the Sprint A2.6 VM smoke test)', async () => {
    const { execSync } = await import('node:child_process');
    const calls: string[] = [];
    vi.mocked(execSync).mockImplementation((cmd) => {
      calls.push(String(cmd));
      return Buffer.from('');
    });
    const loadLib = fakeLib((svc) => {
      calls.push('svc.uninstall()');
      svc.emit('uninstall');
    });

    await uninstallWindowsService(
      { scriptPath: 'C:\\atlas\\agent\\dist\\cli\\bin.js' },
      { loadLib, ...noWait }
    );

    expect(calls[0]).toContain('sc.exe stop');
    expect(calls[1]).toBe('svc.uninstall()');
  });
});

describe('sc.exe-backed helpers (mocked — never invoke the real sc.exe)', () => {
  it('startWindowsService shells out to sc.exe start', async () => {
    const { execSync } = await import('node:child_process');
    await startWindowsService();
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('sc.exe start'),
      expect.anything()
    );
  });

  it('targets the REAL node-windows-registered service id ("atlasruntime.exe"), not the display name ("AtlasRuntime") — confirmed for real during the Sprint A2.6 VM smoke test: sc.exe start/stop/query AtlasRuntime always fails with error 1060 ("service does not exist"), because node-windows registers the service under name.replace(/[^\\w]/gi,"").toLowerCase() + ".exe"', async () => {
    const { execSync } = await import('node:child_process');
    await startWindowsService();
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('atlasruntime.exe'),
      expect.anything()
    );
    expect(execSync).not.toHaveBeenCalledWith(
      expect.stringContaining('sc.exe start AtlasRuntime'),
      expect.anything()
    );

    stopWindowsService();
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('sc.exe stop atlasruntime.exe'),
      expect.anything()
    );

    windowsServiceExists();
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('sc.exe query atlasruntime.exe'),
      expect.anything()
    );
  });

  it('retries sc.exe start a few times before giving up, as a cheap safety net for genuine transient SCM delays', async () => {
    const { execSync } = await import('node:child_process');
    let calls = 0;
    vi.mocked(execSync).mockImplementation(() => {
      calls++;
      if (calls < 3)
        throw new Error(
          'service is marked for deletion' /* real sc.exe error text for this race */
        );
      return Buffer.from('');
    });
    const sleep = vi.fn().mockResolvedValue(undefined);

    await startWindowsService({ sleep });

    expect(calls).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('throws the last error once every retry attempt has failed, instead of retrying forever', async () => {
    const { execSync } = await import('node:child_process');
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('access denied');
    });
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(startWindowsService({ sleep })).rejects.toThrow('access denied');
    expect(execSync).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('stopWindowsService swallows a failure (service already stopped)', async () => {
    const { execSync } = await import('node:child_process');
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('service not running');
    });
    expect(() => stopWindowsService()).not.toThrow();
  });

  it('windowsServiceExists returns true when sc.exe query succeeds', async () => {
    const { execSync } = await import('node:child_process');
    vi.mocked(execSync).mockReturnValue(Buffer.from(''));
    expect(windowsServiceExists()).toBe(true);
  });

  it('windowsServiceExists returns false when sc.exe query fails', async () => {
    const { execSync } = await import('node:child_process');
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('service does not exist');
    });
    expect(windowsServiceExists()).toBe(false);
  });
});
