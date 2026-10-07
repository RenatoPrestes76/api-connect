import { describe, it, expect, vi, beforeEach } from 'vitest';

const promptChoiceMock = vi.fn();
const promptYesNoMock = vi.fn();
const promptRequiredMock = vi.fn();
const promptWithDefaultMock = vi.fn();
const promptPasswordMock = vi.fn();

vi.mock('../../utils/readline-utils.js', () => ({
  promptRequired: promptRequiredMock,
  promptWithDefault: promptWithDefaultMock,
  promptYesNo: promptYesNoMock,
  promptChoice: promptChoiceMock,
  promptPassword: promptPasswordMock,
}));

const testErpConnectionMock = vi.fn();

vi.mock('../../erp-connection/connection-test.js', () => ({
  testErpConnection: testErpConnectionMock,
}));

const { collectErpConnection } = await import('../setup-wizard.js');

describe('collectErpConnection — unsupported dbType refusal', () => {
  beforeEach(() => {
    promptChoiceMock.mockReset();
    promptYesNoMock.mockReset();
    promptRequiredMock.mockReset();
    promptWithDefaultMock.mockReset();
    promptPasswordMock.mockReset();
    testErpConnectionMock.mockReset();
  });

  it('refuses a dbType with no automatic read-only check without ever collecting host/port/credentials or calling testErpConnection', async () => {
    promptYesNoMock
      .mockResolvedValueOnce(true) // "Configure the ERP database connection now?"
      .mockResolvedValueOnce(false); // "Try a different database type?" -> decline, skip
    promptChoiceMock.mockResolvedValueOnce('oracle');

    const result = await collectErpConnection();

    expect(result).toBeUndefined();
    expect(testErpConnectionMock).not.toHaveBeenCalled();
    expect(promptRequiredMock).not.toHaveBeenCalled();
    expect(promptPasswordMock).not.toHaveBeenCalled();
  });

  it('loops back to the dbType choice after refusing an unsupported type, then succeeds with postgres', async () => {
    promptYesNoMock.mockResolvedValueOnce(true); // configure now
    promptChoiceMock
      .mockResolvedValueOnce('mysql') // refused
      .mockResolvedValueOnce('postgres'); // retried, supported
    promptYesNoMock.mockResolvedValueOnce(true); // "Try a different database type?" -> yes
    promptRequiredMock
      .mockResolvedValueOnce('db.internal') // host
      .mockResolvedValueOnce('erp') // database
      .mockResolvedValueOnce('atlas_readonly'); // username
    promptWithDefaultMock.mockResolvedValueOnce('5432'); // port
    promptPasswordMock.mockResolvedValueOnce('secret');
    testErpConnectionMock.mockResolvedValueOnce({ ok: true, readOnly: true });

    const result = await collectErpConnection();

    expect(result).toEqual({
      dbType: 'postgres',
      host: 'db.internal',
      port: 5432,
      database: 'erp',
      username: 'atlas_readonly',
      password: 'secret',
    });
    expect(testErpConnectionMock).toHaveBeenCalledTimes(1);
    expect(testErpConnectionMock).toHaveBeenCalledWith(
      expect.objectContaining({ dbType: 'postgres' })
    );
  });
});
