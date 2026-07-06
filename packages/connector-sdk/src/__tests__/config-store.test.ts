import { describe, it, expect } from 'vitest';
import { InMemoryConfigStore, ConfigMissingError } from '../configuration/config-store.js';
import { validateConfig } from '../configuration/config-schema.js';
import type { ConfigSchema } from '../configuration/config-schema.js';

describe('InMemoryConfigStore', () => {
  it('returns undefined for unknown keys', () => {
    const store = new InMemoryConfigStore();
    expect(store.get('unknown')).toBeUndefined();
    expect(store.has('unknown')).toBe(false);
  });

  it('stores and retrieves values', () => {
    const store = new InMemoryConfigStore({ host: 'localhost', port: 5432 });
    expect(store.get('host')).toBe('localhost');
    expect(store.get('port')).toBe(5432);
    expect(store.has('host')).toBe(true);
  });

  it('getRequired throws ConfigMissingError for missing key', () => {
    const store = new InMemoryConfigStore();
    expect(() => store.getRequired('missing')).toThrow(ConfigMissingError);
  });

  it('getString coerces to string and falls back to default', () => {
    const store = new InMemoryConfigStore({ timeout: 30 });
    expect(store.getString('timeout')).toBe('30');
    expect(store.getString('missing', 'default')).toBe('default');
  });

  it('getNumber coerces numeric strings and falls back to default', () => {
    const store = new InMemoryConfigStore({ port: '5432' });
    expect(store.getNumber('port')).toBe(5432);
    expect(store.getNumber('missing', 80)).toBe(80);
  });

  it('getBoolean handles boolean strings and falls back to default', () => {
    const store = new InMemoryConfigStore({ ssl: 'true', debug: 'false' });
    expect(store.getBoolean('ssl')).toBe(true);
    expect(store.getBoolean('debug')).toBe(false);
    expect(store.getBoolean('missing', true)).toBe(true);
  });

  it('keys() returns all set keys', () => {
    const store = new InMemoryConfigStore({ a: 1, b: 2 });
    expect(store.keys().sort()).toEqual(['a', 'b']);
  });

  it('set() updates values', () => {
    const store = new InMemoryConfigStore();
    store.set('host', 'db.local');
    expect(store.get('host')).toBe('db.local');
    store.set('host', 'db2.local');
    expect(store.get('host')).toBe('db2.local');
  });
});

describe('validateConfig', () => {
  const schema: ConfigSchema = [
    { key: 'host',     type: 'string',  label: 'Host',     required: true },
    { key: 'port',     type: 'number',  label: 'Port',     required: true },
    { key: 'ssl',      type: 'boolean', label: 'SSL',      required: false },
    { key: 'env',      type: 'enum',    label: 'Env',      options: ['prod', 'dev'] },
    { key: 'password', type: 'secret',  label: 'Password', required: true },
  ];

  it('returns empty errors for valid config', () => {
    const errors = validateConfig(schema, { host: 'localhost', port: 5432, password: 'secret', env: 'prod' });
    expect(errors).toHaveLength(0);
  });

  it('reports missing required fields', () => {
    const errors = validateConfig(schema, { host: 'localhost' });
    expect(errors.some((e) => e.field === 'port')).toBe(true);
    expect(errors.some((e) => e.field === 'password')).toBe(true);
  });

  it('reports wrong type for number field', () => {
    const errors = validateConfig(schema, { host: 'localhost', port: 'abc', password: 'x' });
    expect(errors.some((e) => e.field === 'port')).toBe(true);
  });

  it('reports invalid enum value', () => {
    const errors = validateConfig(schema, { host: 'localhost', port: 5432, password: 'x', env: 'staging' });
    expect(errors.some((e) => e.field === 'env')).toBe(true);
  });
});
