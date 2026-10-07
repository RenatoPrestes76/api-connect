import { getDefaultHostname } from '../utils/platform.js';
import {
  promptRequired,
  promptWithDefault,
  promptYesNo,
  promptChoice,
  promptPassword,
} from '../utils/readline-utils.js';
import { testErpConnection, type ErpConnectionTarget } from '../erp-connection/connection-test.js';

export type Environment = 'production' | 'staging' | 'development';

/**
 * Offered for forward compatibility / operator record-keeping — matches
 * the engines @seltriva/database-sdk has drivers for. Only
 * READ_ONLY_CHECK_SUPPORTED_DB_TYPES can actually be verified today; any
 * other choice is refused immediately in collectErpConnection(), before
 * the operator types a host/port/username/password for a connection
 * this installer can't safely vouch for.
 */
const SUPPORTED_DB_TYPES: string[] = ['postgres', 'mysql', 'sqlserver', 'oracle', 'firebird'];

/** Only 'postgres' has a real, automatic connectivity/read-only check (connection-test.ts) — see its own doc comment for why. */
const READ_ONLY_CHECK_SUPPORTED_DB_TYPES: string[] = ['postgres'];

export interface WizardResult {
  name: string;
  environment: Environment;
  hostname: string;
  connectorType: string;
  installService: boolean;
  autoStart: boolean;
  apiBaseUrl: string;
  /** The Ed25519 runtime-registration protocol's credentials — see apps/agent/src/atlas-runtime-client/. What the real daemon (apps/agent/src/cli/bin.ts, run by the service this wizard installs) actually authenticates with. */
  organizationCode: string;
  atlasActivationKey: string;
  /** Undefined if the operator chose to skip ERP configuration during install (can be done later by re-running a config step — not yet implemented, see docs/ATLAS-RUNTIME-CLIENT.md). */
  erpConnection?: ErpConnectionTarget;
}

const DEFAULT_API_URL = 'https://api.seltriva.com';
const DEFAULT_PG_PORT = 5432;

export async function runSetupWizard(opts: { apiBaseUrl?: string }): Promise<WizardResult> {
  banner();

  step(1, 6, 'Runtime identity');

  const name = await promptRequired(
    '  Runtime name (e.g. "Production SQL 01"): ',
    '  Name is required.'
  );

  const hostname = await promptWithDefault('  Hostname', getDefaultHostname());

  const environment = await promptChoice<Environment>(
    '  Environment',
    ['production', 'staging', 'development'],
    'production'
  );

  const connectorType = await promptWithDefault('  Connector type', 'generic');

  step(2, 6, 'API connection');

  const apiBaseUrl =
    opts.apiBaseUrl ?? (await promptWithDefault('  API base URL', DEFAULT_API_URL));

  step(3, 6, 'Atlas runtime enrollment');
  const organizationCode = await promptRequired(
    '  Organization code: ',
    '  Organization code is required.'
  );
  const atlasActivationKey = await promptRequired(
    '  Atlas activation key: ',
    '  Atlas activation key is required.'
  );

  step(4, 6, 'ERP database connection');
  const erpConnection = await collectErpConnection();

  step(5, 6, 'Service installation');

  const installService = await promptYesNo('  Install as a system service?', true);
  const autoStart = installService
    ? await promptYesNo('  Start service automatically on boot?', true)
    : false;

  step(6, 6, 'Confirm');

  process.stdout.write('\n');
  process.stdout.write('  Summary\n');
  process.stdout.write('  ─────────────────────────────────────\n');
  process.stdout.write(`  Name:           ${name}\n`);
  process.stdout.write(`  Hostname:       ${hostname}\n`);
  process.stdout.write(`  Environment:    ${environment}\n`);
  process.stdout.write(`  Connector:      ${connectorType}\n`);
  process.stdout.write(`  API URL:        ${apiBaseUrl}\n`);
  process.stdout.write(`  Organization:   ${organizationCode}\n`);
  process.stdout.write(`  Atlas key:      ${maskSecret(atlasActivationKey)}\n`);
  if (erpConnection) {
    process.stdout.write(
      `  ERP database:   ${erpConnection.dbType} ${erpConnection.username}@${erpConnection.host}:${erpConnection.port}/${erpConnection.database} (read-only, verified)\n`
    );
  } else {
    process.stdout.write('  ERP database:   not configured (skipped)\n');
  }
  process.stdout.write(`  Install service: ${installService ? 'yes' : 'no'}\n`);
  if (installService) {
    process.stdout.write(`  Auto-start:     ${autoStart ? 'yes' : 'no'}\n`);
  }
  process.stdout.write('  ─────────────────────────────────────\n\n');

  const confirmed = await promptYesNo('  Proceed with installation?', true);
  if (!confirmed) {
    process.stdout.write('\n  Installation cancelled.\n\n');
    process.exit(0);
  }

  return {
    name,
    environment,
    hostname,
    connectorType,
    installService,
    autoStart,
    apiBaseUrl,
    organizationCode,
    atlasActivationKey,
    erpConnection,
  };
}

// ─── ERP connection step ──────────────────────────────────────────────────────

/**
 * Collects ERP connection details and validates them via a real
 * connection + a real-only (no write attempted) privilege check
 * (connection-test.ts) before accepting them — loops on failure so the
 * operator can fix a typo or create the missing read-only role without
 * restarting the whole wizard. Returns undefined if the operator
 * explicitly opts to skip this (the Runtime will enroll/heartbeat
 * normally but report any discovery job as failed — see
 * docs/ATLAS-RUNTIME-CLIENT.md).
 */
export async function collectErpConnection(): Promise<ErpConnectionTarget | undefined> {
  const configureNow = await promptYesNo('  Configure the ERP database connection now?', true);
  if (!configureNow) return undefined;

  for (;;) {
    const dbType = await promptChoice('  Database type', SUPPORTED_DB_TYPES, 'postgres');

    if (!READ_ONLY_CHECK_SUPPORTED_DB_TYPES.includes(dbType)) {
      process.stdout.write(
        `\n  ✗ The installer cannot verify "${dbType}" is read-only yet — only postgres has that check today.\n` +
          '    Accepting this connection without that check would risk an unverified write-capable user, so it is refused.\n\n'
      );
      const tryAnother = await promptYesNo('  Try a different database type?', true);
      if (!tryAnother) {
        process.stdout.write('\n  Skipping ERP configuration — you can configure it later.\n\n');
        return undefined;
      }
      continue;
    }

    const host = await promptRequired('  ERP database host: ', '  Host is required.');
    const portStr = await promptWithDefault('  ERP database port', String(DEFAULT_PG_PORT));
    const database = await promptRequired('  ERP database name: ', '  Database name is required.');
    const username = await promptRequired(
      '  ERP database username (must be read-only): ',
      '  Username is required.'
    );
    const password = await promptPassword('  ERP database password: ');

    const target: ErpConnectionTarget = {
      dbType,
      host,
      port: Number(portStr) || DEFAULT_PG_PORT,
      database,
      username,
      password,
    };

    process.stdout.write('\n  Testing connection...\n');
    const result = await testErpConnection(target);

    if (!result.ok) {
      process.stdout.write(`  ✗ ${result.error}\n\n`);
    } else if (!result.readOnly) {
      process.stdout.write(
        '  ✗ This user can write to the database. The Atlas Runtime requires a read-only user.\n' +
          `    ${result.readOnlyViolation ?? ''}\n` +
          '    Create one with:\n\n'
      );
      for (const line of (result.readOnlySetupSql ?? '').split('\n')) {
        process.stdout.write(`      ${line}\n`);
      }
      process.stdout.write('\n');
    } else {
      process.stdout.write('  ✓ Connection OK — confirmed read-only.\n\n');
      return target;
    }

    const retry = await promptYesNo('  Try again with different connection details?', true);
    if (!retry) {
      process.stdout.write('\n  Skipping ERP configuration — you can configure it later.\n\n');
      return undefined;
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function banner(): void {
  process.stdout.write('\n');
  process.stdout.write('  ATLAS Runtime Installer v0.1.0\n');
  process.stdout.write('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');
}

function step(n: number, total: number, label: string): void {
  process.stdout.write(`\n  Step ${n}/${total}  ${label}\n`);
  process.stdout.write('  ─────────────────────────────────────\n');
}

/** First/last 2 chars only — enough to recognize "yes I typed the right one" without echoing the secret. */
function maskSecret(value: string): string {
  if (value.length <= 4) return '*'.repeat(value.length);
  return `${value.slice(0, 2)}${'*'.repeat(value.length - 4)}${value.slice(-2)}`;
}
