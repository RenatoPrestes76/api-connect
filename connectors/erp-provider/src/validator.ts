import type {
  ConnectorResult,
  ValidationResult,
  ValidationIssue,
  ConnectorContext,
} from '@seltriva/connector-sdk';
import { ok, validateConfig } from '@seltriva/connector-sdk';
import { ERP_CONFIG_SCHEMA } from './config/schema.js';

export class ErpValidator {
  constructor(private readonly _ctx: ConnectorContext) {}

  async validate(): Promise<ConnectorResult<ValidationResult>> {
    const start = Date.now();
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    // 1. Config schema validation
    const rawConfig = Object.fromEntries(
      this._ctx.config.keys().map((k) => [k, this._ctx.config.get(k)])
    );
    for (const e of validateConfig(ERP_CONFIG_SCHEMA, rawConfig)) {
      errors.push({ field: e.field, code: 'CONFIG_INVALID', message: e.message });
    }

    // 2. Credentials must be available in the credential store
    if (!(await this._ctx.credentials.has('username'))) {
      errors.push({
        field: 'username',
        code: 'CREDENTIAL_MISSING',
        message: 'username credential not set',
      });
    }
    if (!(await this._ctx.credentials.has('password'))) {
      errors.push({
        field: 'password',
        code: 'CREDENTIAL_MISSING',
        message: 'password credential not set',
      });
    }

    // 3. Timeout range advisory
    const timeout = this._ctx.config.getNumber('timeout', 5000) ?? 5000;
    if (timeout < 100) {
      warnings.push({
        field: 'timeout',
        code: 'TIMEOUT_LOW',
        message: 'timeout below 100ms is not recommended',
      });
    } else if (timeout > 30_000) {
      warnings.push({
        field: 'timeout',
        code: 'TIMEOUT_HIGH',
        message: 'timeout above 30s may cause sync delays',
      });
    }

    return ok({ valid: errors.length === 0, errors, warnings }, Date.now() - start);
  }
}
