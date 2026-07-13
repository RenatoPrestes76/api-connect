import { describe, it, expect } from 'vitest';
import { validateConfig } from '@seltriva/connector-sdk';
import { ERP_CONFIG_SCHEMA } from '../config/schema.js';

const VALID_CONFIG = {
  host: 'erp.local',
  port: 8080,
  database: 'erp_main',
  username: 'svc',
  password: 'secret',
  ssl: false,
  timeout: 5000,
  pollingInterval: 60_000,
};

describe('ERP_CONFIG_SCHEMA', () => {
  it('has 9 fields', () => {
    expect(ERP_CONFIG_SCHEMA).toHaveLength(9);
  });

  it('passes validation with all required fields present', () => {
    const errors = validateConfig(ERP_CONFIG_SCHEMA, VALID_CONFIG);
    expect(errors).toHaveLength(0);
  });

  it('reports error when host is missing', () => {
    const { host: _h, ...cfg } = VALID_CONFIG;
    const errors = validateConfig(ERP_CONFIG_SCHEMA, cfg);
    expect(errors.some((e) => e.field === 'host')).toBe(true);
  });

  it('port omission is valid because its default (8080) satisfies the required check', () => {
    const { port: _p, ...cfg } = VALID_CONFIG;
    const errors = validateConfig(ERP_CONFIG_SCHEMA, cfg);
    expect(errors.some((e) => e.field === 'port')).toBe(false);
  });

  it('reports error when database is missing', () => {
    const { database: _d, ...cfg } = VALID_CONFIG;
    const errors = validateConfig(ERP_CONFIG_SCHEMA, cfg);
    expect(errors.some((e) => e.field === 'database')).toBe(true);
  });

  it('reports error when username is missing', () => {
    const { username: _u, ...cfg } = VALID_CONFIG;
    const errors = validateConfig(ERP_CONFIG_SCHEMA, cfg);
    expect(errors.some((e) => e.field === 'username')).toBe(true);
  });

  it('reports error when password is missing', () => {
    const { password: _pw, ...cfg } = VALID_CONFIG;
    const errors = validateConfig(ERP_CONFIG_SCHEMA, cfg);
    expect(errors.some((e) => e.field === 'password')).toBe(true);
  });

  it('reports error when port is a non-numeric string', () => {
    const errors = validateConfig(ERP_CONFIG_SCHEMA, { ...VALID_CONFIG, port: 'not-a-number' });
    expect(errors.some((e) => e.field === 'port')).toBe(true);
  });

  it('accepts valid config without optional fields (they have defaults)', () => {
    const { ssl: _s, timeout: _t, pollingInterval: _pi, ...required } = VALID_CONFIG;
    const errors = validateConfig(ERP_CONFIG_SCHEMA, required);
    expect(errors).toHaveLength(0);
  });
});
