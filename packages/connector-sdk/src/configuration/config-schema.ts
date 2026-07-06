export type ConfigFieldType = 'string' | 'number' | 'boolean' | 'secret' | 'enum';

export interface ConfigField {
  readonly key:         string;
  readonly type:        ConfigFieldType;
  readonly label:       string;
  readonly description?: string;
  readonly required?:   boolean;
  readonly default?:    unknown;
  /** For type 'enum': the allowed values. */
  readonly options?:    string[];
  /** For type 'string'/'secret': regex the value must match. */
  readonly pattern?:    RegExp;
  readonly sensitive?:  boolean;
}

export type ConfigSchema = readonly ConfigField[];

export class ConfigValidationError extends Error {
  constructor(
    public readonly field:   string,
    message:                 string,
  ) {
    super(`Config validation error for field "${field}": ${message}`);
    this.name = 'ConfigValidationError';
  }
}

/** Validate a config object against a schema. Returns a list of errors (empty = valid). */
export function validateConfig(
  schema:  ConfigSchema,
  config:  Record<string, unknown>,
): ConfigValidationError[] {
  const errors: ConfigValidationError[] = [];

  for (const field of schema) {
    const value = config[field.key] ?? field.default;

    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push(new ConfigValidationError(field.key, 'field is required'));
      continue;
    }

    if (value === undefined || value === null) continue;

    if (field.type === 'number' && typeof value !== 'number') {
      errors.push(new ConfigValidationError(field.key, `expected number, got ${typeof value}`));
    }
    if (field.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(new ConfigValidationError(field.key, `expected boolean, got ${typeof value}`));
    }
    if ((field.type === 'string' || field.type === 'secret') && typeof value !== 'string') {
      errors.push(new ConfigValidationError(field.key, `expected string, got ${typeof value}`));
    }
    if (field.type === 'enum' && field.options && !field.options.includes(String(value))) {
      errors.push(new ConfigValidationError(field.key, `must be one of: ${field.options.join(', ')}`));
    }
    if (field.pattern && typeof value === 'string' && !field.pattern.test(value)) {
      errors.push(new ConfigValidationError(field.key, `does not match required pattern`));
    }
  }

  return errors;
}
