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
  it('resolves when node-windows emits "uninstall"', async () => {
    const loadLib = fakeLib((svc) => svc.emit('uninstall'));
    await expect(
      uninstallWindowsService({ scriptPath: 'C:\\atlas\\agent\\dist\\cli\\bin.js' }, { loadLib })
    ).resolves.toBeUndefined();
  });

  it('resolves when node-windows emits "alreadyuninstalled"', async () => {
    const loadLib = fakeLib((svc) => svc.emit('alreadyuninstalled'));
    await expect(
      uninstallWindowsService({ scriptPath: 'C:\\atlas\\agent\\dist\\cli\\bin.js' }, { loadLib })
    ).resolves.toBeUndefined();
  });

  it('rejects when node-windows emits "error"', async () => {
    const loadLib = fakeLib((svc) => svc.emit('error', new Error('not found')));
    await expect(
      uninstallWindowsService({ scriptPath: 'C:\\atlas\\agent\\dist\\cli\\bin.js' }, { loadLib })
    ).rejects.toThrow('not found');
  });
});

describe('sc.exe-backed helpers (mocked — never invoke the real sc.exe)', () => {
  it('startWindowsService shells out to sc.exe start', async () => {
    const { execSync } = await import('node:child_process');
    startWindowsService();
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('sc.exe start'),
      expect.anything()
    );
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
