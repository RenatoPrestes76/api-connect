import { getDefaultHostname } from '../utils/platform.js';
import {
  prompt,
  promptRequired,
  promptWithDefault,
  promptYesNo,
  promptChoice,
} from '../utils/readline-utils.js';
import { isValidTokenFormat, normalizeToken } from '../activation/token-validator.js';

export type Environment = 'production' | 'staging' | 'development';

export interface WizardResult {
  activationToken: string;
  name: string;
  environment: Environment;
  hostname: string;
  connectorType: string;
  installService: boolean;
  autoStart: boolean;
  apiBaseUrl: string;
}

const DEFAULT_API_URL = 'https://api.seltriva.com';

export async function runSetupWizard(opts: {
  token?: string;
  apiBaseUrl?: string;
}): Promise<WizardResult> {
  banner();

  step(1, 5, 'Activation');

  let activationToken: string;
  if (opts.token && isValidTokenFormat(opts.token)) {
    activationToken = normalizeToken(opts.token);
    process.stdout.write(`  Token: ${maskToken(activationToken)}\n`);
  } else {
    if (opts.token) {
      process.stdout.write(`  Invalid token format provided — please re-enter.\n`);
    }
    activationToken = await promptValidToken();
  }

  step(2, 5, 'Runtime identity');

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

  step(3, 5, 'API connection');

  const apiBaseUrl =
    opts.apiBaseUrl ?? (await promptWithDefault('  API base URL', DEFAULT_API_URL));

  step(4, 5, 'Service installation');

  const installService = await promptYesNo('  Install as a system service?', true);
  const autoStart = installService
    ? await promptYesNo('  Start service automatically on boot?', true)
    : false;

  step(5, 5, 'Confirm');

  process.stdout.write('\n');
  process.stdout.write('  Summary\n');
  process.stdout.write('  ─────────────────────────────────────\n');
  process.stdout.write(`  Token:          ${maskToken(activationToken)}\n`);
  process.stdout.write(`  Name:           ${name}\n`);
  process.stdout.write(`  Hostname:       ${hostname}\n`);
  process.stdout.write(`  Environment:    ${environment}\n`);
  process.stdout.write(`  Connector:      ${connectorType}\n`);
  process.stdout.write(`  API URL:        ${apiBaseUrl}\n`);
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
    activationToken,
    name,
    environment,
    hostname,
    connectorType,
    installService,
    autoStart,
    apiBaseUrl,
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

async function promptValidToken(): Promise<string> {
  while (true) {
    const raw = await prompt('  Activation Token (ATLAS-XXXX-XXXX-XXXX): ');
    const token = normalizeToken(raw);
    if (isValidTokenFormat(token)) return token;
    process.stdout.write('  Invalid format. Expected: ATLAS-XXXX-XXXX-XXXX\n');
  }
}

function maskToken(token: string): string {
  // Show first segment, mask the rest: ATLAS-XXXX-****-****
  const parts = token.split('-');
  return `${parts[0]}-${parts[1]}-****-****`;
}
