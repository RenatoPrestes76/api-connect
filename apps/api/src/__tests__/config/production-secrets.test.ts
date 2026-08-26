import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  assertProductionSecretsConfigured,
  assertProductionCorsConfigured,
} from '../../services/production-secrets.js';

const SECRET_ENV_VARS = [
  'ADMIN_JWT_SECRET',
  'PORTAL_JWT_SECRET',
  'RUNTIME_JWT_SECRET',
  'RUNTIME_CERT_SECRET',
  'CONNECTOR_PACKAGE_SECRET',
  'MESSAGE_DELIVERY_SECRET',
  'ATLAS_MASTER_KEY',
] as const;

describe('assertProductionSecretsConfigured', () => {
  const originalValues: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of SECRET_ENV_VARS) {
      originalValues[key] = process.env[key];
      Reflect.deleteProperty(process.env, key);
    }
  });

  afterEach(() => {
    for (const key of SECRET_ENV_VARS) {
      if (originalValues[key] === undefined) Reflect.deleteProperty(process.env, key);
      else process.env[key] = originalValues[key];
    }
  });

  it('is a no-op outside production even when every secret is unset', () => {
    expect(() => assertProductionSecretsConfigured('development')).not.toThrow();
    expect(() => assertProductionSecretsConfigured('test')).not.toThrow();
  });

  it('throws in production when secrets are unset, naming every missing var', () => {
    expect(() => assertProductionSecretsConfigured('production')).toThrowError(/ADMIN_JWT_SECRET/);
  });

  it('throws in production when only some secrets are configured', () => {
    process.env['ADMIN_JWT_SECRET'] = 'a-real-production-secret';
    expect(() => assertProductionSecretsConfigured('production')).toThrowError(/PORTAL_JWT_SECRET/);
  });

  it('does not throw in production once every secret is explicitly configured', () => {
    for (const key of SECRET_ENV_VARS) {
      process.env[key] = `configured-${key}`;
    }
    expect(() => assertProductionSecretsConfigured('production')).not.toThrow();
  });
});

describe('assertProductionCorsConfigured', () => {
  const original = process.env['CORS_ALLOWED_ORIGINS'];

  afterEach(() => {
    if (original === undefined) Reflect.deleteProperty(process.env, 'CORS_ALLOWED_ORIGINS');
    else process.env['CORS_ALLOWED_ORIGINS'] = original;
  });

  it('is a no-op outside production even when unset', () => {
    Reflect.deleteProperty(process.env, 'CORS_ALLOWED_ORIGINS');
    expect(() => assertProductionCorsConfigured('development')).not.toThrow();
    expect(() => assertProductionCorsConfigured('test')).not.toThrow();
  });

  it('throws in production when CORS_ALLOWED_ORIGINS is unset', () => {
    Reflect.deleteProperty(process.env, 'CORS_ALLOWED_ORIGINS');
    expect(() => assertProductionCorsConfigured('production')).toThrowError(/CORS_ALLOWED_ORIGINS/);
  });

  it('throws in production when CORS_ALLOWED_ORIGINS is the open wildcard', () => {
    process.env['CORS_ALLOWED_ORIGINS'] = '*';
    expect(() => assertProductionCorsConfigured('production')).toThrowError(/CORS_ALLOWED_ORIGINS/);
  });

  it('does not throw in production once a real allowlist is configured', () => {
    process.env['CORS_ALLOWED_ORIGINS'] =
      'https://app.atlasappruntime.com.br,https://admin.atlasappruntime.com.br';
    expect(() => assertProductionCorsConfigured('production')).not.toThrow();
  });
});
