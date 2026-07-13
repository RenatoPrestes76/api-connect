import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationEngine } from '../validation/validation-engine.js';
import type { TableSchema } from '../types/index.js';

const SCHEMA: TableSchema = {
  schema: 'public',
  table: 'produto',
  fields: [
    { name: 'id', type: 'integer', required: true, nullable: false },
    { name: 'nome', type: 'varchar', required: true, nullable: false },
    { name: 'preco', type: 'numeric', required: true, nullable: false },
    { name: 'ativo', type: 'boolean', required: false, nullable: true },
  ],
};

describe('ValidationEngine', () => {
  let engine: ValidationEngine;

  beforeEach(() => {
    engine = new ValidationEngine();
    engine.registerSchema(SCHEMA);
  });

  it('validates a valid record', () => {
    const result = engine.validate('public', 'produto', { id: 1, nome: 'Produto A', preco: 9.99 });
    expect(result.isValid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('fails when required field is null', () => {
    const result = engine.validate('public', 'produto', { id: 1, nome: null, preco: 10 });
    expect(result.isValid).toBe(false);
    expect(result.violations.some((v) => v.includes('nome'))).toBe(true);
  });

  it('fails when required field is missing', () => {
    const result = engine.validate('public', 'produto', { id: 1, preco: 10 });
    expect(result.isValid).toBe(false);
    expect(result.violations.some((v) => v.includes('nome'))).toBe(true);
  });

  it('fails when numeric field has non-numeric string', () => {
    const result = engine.validate('public', 'produto', { id: 1, nome: 'P', preco: 'abc' });
    expect(result.isValid).toBe(false);
    expect(result.violations.some((v) => v.includes('preco'))).toBe(true);
  });

  it('passes when optional field is absent', () => {
    const result = engine.validate('public', 'produto', { id: 1, nome: 'OK', preco: 1 });
    expect(result.isValid).toBe(true);
  });

  it('validates without schema registered (no-op, always valid)', () => {
    const result = engine.validate('other', 'no_schema', { x: 1 });
    expect(result.isValid).toBe(true);
  });

  it('batch validates multiple records', () => {
    const records = [
      { id: 1, nome: 'A', preco: 1 },
      { id: 2, nome: 'B', preco: 2 },
    ];
    const results = engine.validateBatch('public', 'produto', records);
    expect(results).toHaveLength(2);
    expect(results[0]?.isValid).toBe(true);
    expect(results[1]?.isValid).toBe(true);
  });

  it('batch validates and detects duplicate ids', () => {
    const records = [
      { id: 1, nome: 'A', preco: 1 },
      { id: 2, nome: 'B', preco: 2 },
      { id: 1, nome: 'C', preco: 3 }, // duplicate
    ];
    const results = engine.validateBatch('public', 'produto', records);
    expect(results[2]?.isValid).toBe(false);
    expect(results[2]?.violations.some((v) => v.toLowerCase().includes('duplicate'))).toBe(true);
  });

  it('clears duplicate cache between batches', () => {
    const record = { id: 1, nome: 'A', preco: 1 };
    engine.validateBatch('public', 'produto', [record]);
    engine.clearDuplicateCache();
    const results = engine.validateBatch('public', 'produto', [record]);
    expect(results[0]?.isValid).toBe(true);
  });

  it('exposes schemaCount', () => {
    expect(engine.schemaCount).toBe(1);
  });
});
