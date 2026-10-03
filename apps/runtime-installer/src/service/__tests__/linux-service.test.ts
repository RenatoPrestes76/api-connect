import { describe, it, expect, vi, afterEach } from 'vitest';

// Mocked so these tests never touch a real /etc/systemd/system or call
// systemctl — even on a Linux CI runner, writing a real unit file is a
// persistent system change, never a side effect of a unit test.
vi.mock('node:fs', () => ({
  default: {
    writeFileSync: vi.fn(),
    existsSync: vi.fn(() => false),
    unlinkSync: vi.fn(),
  },
}));
vi.mock('node:child_process', () => ({ execSync: vi.fn() }));

import {
  installLinuxService,
  uninstallLinuxService,
  startLinuxService,
  stopLinuxService,
  linuxServiceExists,
} from '../linux-service.js';

afterEach(() => {
  vi.clearAllMocks();
});

const BASE_OPTS = {
  runtimeRoot: '/opt/seltriva/atlas',
  autoStart: true,
  scriptPath: '/opt/seltriva/atlas/agent/dist/cli/bin.js',
  env: { ATLAS_API_URL: 'https://atlas.example.com', ATLAS_ORGANIZATION_CODE: 'ORG-1' },
};

describe('installLinuxService', () => {
  it('writes a unit file whose ExecStart runs node against the real agent entrypoint, not a nonexistent binary', async () => {
    const fs = (await import('node:fs')).default;
    installLinuxService(BASE_OPTS);
    const [, contents] = vi.mocked(fs.writeFileSync).mock.calls[0]!;
    expect(String(contents)).toContain(`ExecStart=${process.execPath} ${BASE_OPTS.scriptPath}`);
  });

  it('writes one Environment= line per env var', async () => {
    const fs = (await import('node:fs')).default;
    installLinuxService(BASE_OPTS);
    const [, contents] = vi.mocked(fs.writeFileSync).mock.calls[0]!;
    expect(String(contents)).toContain('Environment=ATLAS_API_URL=https://atlas.example.com');
    expect(String(contents)).toContain('Environment=ATLAS_ORGANIZATION_CODE=ORG-1');
  });

  it('reloads systemd after writing the unit', async () => {
    const { execSync } = await import('node:child_process');
    installLinuxService(BASE_OPTS);
    expect(execSync).toHaveBeenCalledWith('systemctl daemon-reload', expect.anything());
  });

  it('enables the service only when autoStart is true', async () => {
    const { execSync } = await import('node:child_process');
    installLinuxService({ ...BASE_OPTS, autoStart: false });
    expect(execSync).not.toHaveBeenCalledWith(
      expect.stringContaining('systemctl enable'),
      expect.anything()
    );
  });

  it('includes a User= line when a user is specified', async () => {
    const fs = (await import('node:fs')).default;
    installLinuxService({ ...BASE_OPTS, user: 'atlas-svc' });
    const [, contents] = vi.mocked(fs.writeFileSync).mock.calls[0]!;
    expect(String(contents)).toContain('User=atlas-svc');
  });
});

describe('uninstallLinuxService', () => {
  it('stops, disables, and removes the unit file', async () => {
    const fs = (await import('node:fs')).default;
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const { execSync } = await import('node:child_process');

    uninstallLinuxService();

    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('systemctl stop'),
      expect.anything()
    );
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('systemctl disable'),
      expect.anything()
    );
    expect(fs.unlinkSync).toHaveBeenCalled();
  });
});

describe('sc-equivalent helpers (mocked — never invoke the real systemctl)', () => {
  it('startLinuxService calls systemctl start', async () => {
    const { execSync } = await import('node:child_process');
    startLinuxService();
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('systemctl start'),
      expect.anything()
    );
  });

  it('stopLinuxService swallows a failure', async () => {
    const { execSync } = await import('node:child_process');
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('not running');
    });
    expect(() => stopLinuxService()).not.toThrow();
  });

  it('linuxServiceExists reflects whether the unit file exists', async () => {
    const fs = (await import('node:fs')).default;
    vi.mocked(fs.existsSync).mockReturnValue(true);
    expect(linuxServiceExists()).toBe(true);
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(linuxServiceExists()).toBe(false);
  });
});
