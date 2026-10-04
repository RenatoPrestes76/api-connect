import { getDefaultHostname } from '../utils/platform.js';
import {
  promptRequired,
  promptWithDefault,
  promptYesNo,
  promptChoice,
} from '../utils/readline-utils.js';

export type Environment = 'production' | 'staging' | 'development';

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
}

const DEFAULT_API_URL = 'https://api.seltriva.com';

export async function runSetupWizard(opts: { apiBaseUrl?: string }): Promise<WizardResult> {
  banner();

  step(1, 5, 'Runtime identity');

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

  step(2, 5, 'API connection');

  const apiBaseUrl =
    opts.apiBaseUrl ?? (await promptWithDefault('  API base URL', DEFAULT_API_URL));

  step(3, 5, 'Atlas runtime enrollment');
  const organizationCode = await promptRequired(
    '  Organization code: ',
    '  Organization code is required.'
  );
  const atlasActivationKey = await promptRequired(
    '  Atlas activation key: ',
    '  Atlas activation key is required.'
  );

  step(4, 5, 'Service installation');

  const installService = await promptYesNo('  Install as a system service?', true);
  const autoStart = installService
    ? await promptYesNo('  Start service automatically on boot?', true)
    : false;

  step(5, 5, 'Confirm');

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
  };
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
