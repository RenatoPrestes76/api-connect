import { describe, it, expect } from 'vitest';
import { Telemetry } from '../telemetry/telemetry.js';
import { asCorrelationId } from '../types/index.js';
import type { StructuredLog } from '../types/index.js';

describe('Telemetry', () => {
  it('calls observer on log', () => {
    const logs: StructuredLog[] = [];
    const t = new Telemetry({ correlationId: asCorrelationId('c-1') }, 'DEBUG');
    t.observe((log) => logs.push(log));

    t.info('hello');
    expect(logs).toHaveLength(1);
    expect(logs[0]?.message).toBe('hello');
    expect(logs[0]?.level).toBe('INFO');
  });

  it('filters logs below configured level', () => {
    const logs: StructuredLog[] = [];
    const t = new Telemetry({}, 'WARN');
    t.observe((log) => logs.push(log));

    t.debug('ignored');
    t.info('also ignored');
    t.warn('included');
    t.error('also included');

    expect(logs).toHaveLength(2);
    expect(logs[0]?.level).toBe('WARN');
    expect(logs[1]?.level).toBe('ERROR');
  });

  it('child context inherits parent context', () => {
    const logs: StructuredLog[] = [];
    const parent = new Telemetry({ schema: 'public' }, 'DEBUG');
    parent.observe((log) => logs.push(log));

    const child = parent.child({ table: 'produto' });
    child.info('child log');

    expect(logs[0]?.schema).toBe('public');
    expect(logs[0]?.table).toBe('produto');
  });

  it('observe() returns an unsubscribe function', () => {
    const logs: StructuredLog[] = [];
    const t = new Telemetry({}, 'DEBUG');
    const unsubscribe = t.observe((log) => logs.push(log));

    t.info('before');
    unsubscribe();
    t.info('after');

    expect(logs).toHaveLength(1);
    expect(logs[0]?.message).toBe('before');
  });

  it('timed() measures async duration and returns value', async () => {
    const t = new Telemetry({}, 'DEBUG');
    const result = await t.timed('operation', async () => {
      await new Promise((r) => setTimeout(r, 10));
      return 42;
    });
    expect(result).toBe(42);
  });

  it('error() includes error message in log', () => {
    const logs: StructuredLog[] = [];
    const t = new Telemetry({}, 'DEBUG');
    t.observe((log) => logs.push(log));

    t.error('something failed', new Error('boom'));
    expect(logs[0]?.error).toBe('boom');
    expect(logs[0]?.level).toBe('ERROR');
  });

  it('setLevel() changes minimum level', () => {
    const logs: StructuredLog[] = [];
    const t = new Telemetry({}, 'ERROR');
    t.observe((log) => logs.push(log));

    t.info('not emitted');
    expect(logs).toHaveLength(0);

    t.setLevel('DEBUG');
    t.info('now emitted');
    expect(logs).toHaveLength(1);
  });

  it('extra fields are stored in fields map', () => {
    const logs: StructuredLog[] = [];
    const t = new Telemetry({}, 'DEBUG');
    t.observe((log) => logs.push(log));

    t.info('with fields', { batchId: 'b-1', count: 100 });
    expect(logs[0]?.fields['batchId']).toBe('b-1');
    expect(logs[0]?.fields['count']).toBe(100);
  });

  it('observer errors do not stop execution', () => {
    const t = new Telemetry({}, 'DEBUG');
    t.observe(() => { throw new Error('observer crash'); });
    expect(() => t.info('safe')).not.toThrow();
  });
});
