import { describe, it, expect } from 'vitest';
import { PluginRegistry } from '../core/plugin-registry.js';
import type { LoadedPlugin } from '../loader/plugin-loader.js';
import type { Connector } from '../interfaces/connector.js';

function makePlugin(id: string): LoadedPlugin {
  return {
    manifest: {
      id,
      name:         id,
      version:      '1.0.0',
      sdkVersion:   '0.1.0',
      vendor:       'test',
      category:     'database',
      description:  'test connector',
      entry:        'index.js',
      hash:         'a'.repeat(64),
      signature:    '',
      publicKeyId:  '',
      capabilities: {
        canDiscover: true, canSynchronize: true, canValidate: true,
        canStream: false,  canBulkWrite: false,  supportsSSL: true,
      },
      updatable: true,
    },
    connector: {} as Connector,
  };
}

describe('PluginRegistry', () => {
  it('registers a plugin and retrieves it by id', () => {
    const registry = new PluginRegistry();
    const plugin   = makePlugin('com.test.db');
    registry.register(plugin);

    const entry = registry.get('com.test.db');
    expect(entry).not.toBeNull();
    expect(entry!.status).toBe('registered');
    expect(entry!.failureCount).toBe(0);
  });

  it('throws when registering the same id twice', () => {
    const registry = new PluginRegistry();
    registry.register(makePlugin('dup'));
    expect(() => registry.register(makePlugin('dup'))).toThrow();
  });

  it('returns null for unknown id', () => {
    const registry = new PluginRegistry();
    expect(registry.get('unknown')).toBeNull();
  });

  it('unregister removes the plugin', () => {
    const registry = new PluginRegistry();
    registry.register(makePlugin('to-remove'));
    registry.unregister('to-remove');
    expect(registry.get('to-remove')).toBeNull();
    expect(registry.size).toBe(0);
  });

  it('setStatus changes the plugin status', () => {
    const registry = new PluginRegistry();
    registry.register(makePlugin('conn'));
    registry.setStatus('conn', 'running');
    expect(registry.get('conn')!.status).toBe('running');
  });

  it('recordFailure sets status to failed and increments count', () => {
    const registry = new PluginRegistry();
    registry.register(makePlugin('conn'));
    registry.recordFailure('conn', new Error('connection refused'));

    const entry = registry.get('conn')!;
    expect(entry.status).toBe('failed');
    expect(entry.failureCount).toBe(1);
    expect(entry.lastError?.message).toBe('connection refused');
  });

  it('byStatus filters correctly', () => {
    const registry = new PluginRegistry();
    registry.register(makePlugin('a'));
    registry.register(makePlugin('b'));
    registry.setStatus('a', 'running');

    expect(registry.byStatus('running')).toHaveLength(1);
    expect(registry.byStatus('registered')).toHaveLength(1);
  });
});
