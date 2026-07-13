import { describe, it, expect, vi } from 'vitest';
import { ConflictResolver } from '../conflict/conflict-resolver.js';
import type { ConflictContext } from '../conflict/conflict-resolver.js';

const EXISTING: Record<string, unknown> = { id: 1, nome: 'Produto A', versao: 1 };
const INCOMING: Record<string, unknown> = { id: 1, nome: 'Produto B', versao: 2 };

function ctx(strategy: ConflictContext['strategy']): ConflictContext {
  return {
    schema: 'public',
    table: 'produto',
    incoming: INCOMING as never,
    existing: EXISTING as never,
    strategy,
  };
}

describe('ConflictResolver — SKIP', () => {
  it('returns SKIP action and keeps existing record', () => {
    const resolver = new ConflictResolver();
    const result = resolver.resolve(ctx('SKIP'));
    expect(result.action).toBe('SKIP');
    expect(result.record).toEqual(EXISTING);
    expect(result.strategy).toBe('SKIP');
  });
});

describe('ConflictResolver — OVERWRITE', () => {
  it('returns WRITE action with incoming record', () => {
    const resolver = new ConflictResolver();
    const result = resolver.resolve(ctx('OVERWRITE'));
    expect(result.action).toBe('WRITE');
    expect(result.record).toEqual(INCOMING);
    expect(result.strategy).toBe('OVERWRITE');
  });
});

describe('ConflictResolver — MERGE', () => {
  it('merges incoming into existing (incoming wins on conflict)', () => {
    const resolver = new ConflictResolver();
    const result = resolver.resolve(ctx('MERGE'));
    expect(result.action).toBe('WRITE');
    expect(result.strategy).toBe('MERGE');
    // incoming.nome overwrites existing.nome
    expect((result.record as typeof INCOMING)['nome']).toBe('Produto B');
    // existing fields preserved
    expect((result.record as typeof INCOMING)['id']).toBe(1);
  });

  it('null incoming fields do not overwrite existing', () => {
    const resolver = new ConflictResolver();
    const result = resolver.resolve({
      schema: 'public',
      table: 'produto',
      strategy: 'MERGE',
      existing: { id: 1, nome: 'Produto A' } as never,
      incoming: { id: 1, nome: null } as never,
    });
    expect((result.record as Record<string, unknown>)['nome']).toBe('Produto A');
  });
});

describe('ConflictResolver — VERSION', () => {
  it('uses incoming when incoming version is higher', () => {
    const resolver = new ConflictResolver();
    const result = resolver.resolve(ctx('VERSION'));
    expect(result.action).toBe('WRITE');
    expect((result.record as typeof INCOMING)['versao']).toBe(2);
  });

  it('skips incoming when existing version is equal or higher', () => {
    const resolver = new ConflictResolver();
    const result = resolver.resolve({
      schema: 'public',
      table: 'produto',
      strategy: 'VERSION',
      existing: { id: 1, versao: 5 } as never,
      incoming: { id: 1, versao: 2 } as never,
    });
    expect(result.action).toBe('SKIP');
  });

  it('falls back to version=0 when no version column present', () => {
    const resolver = new ConflictResolver();
    // No version column → both version=0, incoming is not higher → SKIP
    const result = resolver.resolve({
      schema: 'public',
      table: 'produto',
      strategy: 'VERSION',
      existing: { id: 1, nome: 'A' } as never,
      incoming: { id: 1, nome: 'B' } as never,
    });
    expect(result.action).toBe('SKIP');
  });
});

describe('ConflictResolver — CUSTOM', () => {
  it('uses registered custom resolver for table', () => {
    const resolver = new ConflictResolver();
    const customFn = vi
      .fn()
      .mockReturnValue({ action: 'WRITE', record: INCOMING, strategy: 'CUSTOM', reason: 'custom' });
    resolver.registerCustom('public.produto', customFn);

    const result = resolver.resolve(ctx('CUSTOM'));
    expect(customFn).toHaveBeenCalledOnce();
    expect(result.action).toBe('WRITE');
  });

  it('uses wildcard resolver when no table-specific resolver registered', () => {
    const resolver = new ConflictResolver();
    const customFn = vi.fn().mockReturnValue({
      action: 'SKIP',
      record: EXISTING,
      strategy: 'CUSTOM',
      reason: 'wildcard',
    });
    resolver.registerCustom('*', customFn);

    const result = resolver.resolve(ctx('CUSTOM'));
    expect(customFn).toHaveBeenCalledOnce();
    expect(result.action).toBe('SKIP');
  });

  it('defaults to SKIP when no custom resolver registered', () => {
    const resolver = new ConflictResolver();
    const result = resolver.resolve(ctx('CUSTOM'));
    expect(result.action).toBe('SKIP');
    expect(result.reason).toContain('No custom resolver');
  });
});
