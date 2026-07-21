/**
 * inferSchema — unit tests
 *
 * Tests: array inference, object inference, format detection,
 * nullable detection, nested objects, paginated response unwrapping.
 */
import { describe, it, expect } from 'vitest';
import { inferSchema, schemaToMarkdown, type InferredField } from './schema-inference.js';

describe('inferSchema', () => {
  describe('primitive', () => {
    it('returns primitive schema for non-object/array', () => {
      expect(inferSchema('hello').type).toBe('primitive');
      expect(inferSchema(42).type).toBe('primitive');
      expect(inferSchema(null).type).toBe('primitive');
    });
  });

  describe('object', () => {
    it('infers fields from a plain object', () => {
      const data = { id: '123', name: 'Alice', age: 30, active: true };
      const schema = inferSchema(data);
      expect(schema.type).toBe('object');

      const fieldNames = schema.fields.map((f) => f.key);
      expect(fieldNames).toContain('id');
      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('age');
      expect(fieldNames).toContain('active');
    });

    it('infers correct types for each field', () => {
      const data = { name: 'Bob', count: 5, enabled: false, meta: { x: 1 } };
      const schema = inferSchema(data);

      const find = (key: string): InferredField => schema.fields.find((f) => f.key === key)!;
      expect(find('name').type).toBe('string');
      expect(find('count').type).toBe('number');
      expect(find('enabled').type).toBe('boolean');
      expect(find('meta').type).toBe('object');
    });

    it('marks null fields as nullable', () => {
      const data = { name: 'Test', deletedAt: null };
      const schema = inferSchema(data);

      const deletedAt = schema.fields.find((f) => f.key === 'deletedAt')!;
      expect(deletedAt.nullable).toBe(true);
      expect(deletedAt.type).toBe('null');
    });

    it('nests children for object fields', () => {
      const data = { address: { street: '123 Main St', city: 'Anytown' } };
      const schema = inferSchema(data);

      const address = schema.fields.find((f) => f.key === 'address')!;
      expect(address.type).toBe('object');
      expect(address.children).toBeDefined();
      expect(address.children!.map((c) => c.key)).toContain('street');
      expect(address.children!.map((c) => c.key)).toContain('city');
    });

    it('unwraps paginated response — finds the array field', () => {
      const paginated = { data: [{ id: '1' }, { id: '2' }], total: 2, page: 1 };
      const schema = inferSchema(paginated);
      // Should detect the array and infer from it
      expect(schema.fields.length).toBeGreaterThan(0);
      const idField = schema.fields.find((f) => f.key === 'id');
      expect(idField).toBeDefined();
      expect(idField!.type).toBe('string');
    });
  });

  describe('array', () => {
    it('infers from an array of objects', () => {
      const data = [
        { id: '1', role: 'admin', score: 99 },
        { id: '2', role: 'user', score: 42 },
      ];
      const schema = inferSchema(data);
      expect(schema.type).toBe('array');
      expect(schema.totalRecords).toBe(2);

      const fieldNames = schema.fields.map((f) => f.key);
      expect(fieldNames).toContain('id');
      expect(fieldNames).toContain('role');
      expect(fieldNames).toContain('score');
    });

    it('sets sampleSize to actual array length (or max 50)', () => {
      const data = Array.from({ length: 10 }, (_, i) => ({ n: i }));
      const schema = inferSchema(data);
      expect(schema.sampleSize).toBe(10);
    });

    it('caps sample at 50 for large arrays', () => {
      const data = Array.from({ length: 200 }, (_, i) => ({ n: i }));
      const schema = inferSchema(data);
      expect(schema.sampleSize).toBe(50);
      expect(schema.totalRecords).toBe(200);
    });

    it('detects nullable fields when some records have null', () => {
      const data = [
        { id: '1', email: 'a@b.com' },
        { id: '2', email: null },
      ];
      const schema = inferSchema(data);
      const email = schema.fields.find((f) => f.key === 'email')!;
      expect(email.nullable).toBe(true);
    });

    it('handles empty array gracefully', () => {
      const schema = inferSchema([]);
      expect(schema.type).toBe('array');
      expect(schema.fields).toHaveLength(0);
    });
  });

  describe('format detection', () => {
    it('detects uuid format', () => {
      const data = { id: '550e8400-e29b-41d4-a716-446655440000' };
      const schema = inferSchema(data);
      const id = schema.fields.find((f) => f.key === 'id')!;
      expect(id.format).toBe('uuid');
    });

    it('detects date-time format', () => {
      const data = { createdAt: '2024-01-15T10:30:00Z' };
      const schema = inferSchema(data);
      const field = schema.fields.find((f) => f.key === 'createdAt')!;
      expect(field.format).toBe('date-time');
    });

    it('detects date format', () => {
      const data = { birthday: '2000-06-15' };
      const schema = inferSchema(data);
      const field = schema.fields.find((f) => f.key === 'birthday')!;
      expect(field.format).toBe('date');
    });

    it('detects uri format', () => {
      const data = { website: 'https://example.com/path' };
      const schema = inferSchema(data);
      const field = schema.fields.find((f) => f.key === 'website')!;
      expect(field.format).toBe('uri');
    });

    it('detects email format', () => {
      const data = { email: 'user@example.com' };
      const schema = inferSchema(data);
      const field = schema.fields.find((f) => f.key === 'email')!;
      expect(field.format).toBe('email');
    });

    it('does not set format for plain strings', () => {
      const data = { name: 'Alice Smith' };
      const schema = inferSchema(data);
      const field = schema.fields.find((f) => f.key === 'name')!;
      expect(field.format).toBeUndefined();
    });
  });

  describe('array item type inference', () => {
    it('infers item type for array-of-strings fields', () => {
      const data = { tags: ['typescript', 'node', 'api'] };
      const schema = inferSchema(data);
      const tags = schema.fields.find((f) => f.key === 'tags')!;
      expect(tags.type).toBe('array');
      expect(tags.arrayItemType).toBeDefined();
      expect(tags.arrayItemType!.type).toBe('string');
    });
  });
});

describe('schemaToMarkdown', () => {
  it('generates a markdown table with field info', () => {
    const schema = inferSchema({ id: '123', name: 'Test', count: 5 });
    const md = schemaToMarkdown(schema, 'TestResponse');
    expect(md).toContain('## TestResponse Schema');
    expect(md).toContain('| Field |');
    expect(md).toContain('`id`');
    expect(md).toContain('`name`');
    expect(md).toContain('`count`');
  });

  it('includes nested field paths with dot notation', () => {
    const schema = inferSchema({ user: { id: '1', name: 'Bob' } });
    const md = schemaToMarkdown(schema);
    expect(md).toContain('`user.id`');
    expect(md).toContain('`user.name`');
  });
});
