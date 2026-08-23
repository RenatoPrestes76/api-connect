import { describe, it, expect } from 'vitest';
import type { ServerResponse } from 'node:http';
import { z } from 'zod';
import { parseBody, parseQuery, parseParams } from '../../http/validation.js';
import type { RouteContext } from '../../http/router.js';

interface FakeResState {
  statusCode?: number;
  body?: string;
}

function fakeRes(): FakeResState & { res: ServerResponse } {
  const state: FakeResState & { res: ServerResponse } = {
    res: undefined as unknown as ServerResponse,
  };
  state.res = {
    headersSent: false,
    writeHead(status: number) {
      state.statusCode = status;
    },
    end(body: string) {
      state.body = body;
    },
  } as unknown as ServerResponse;
  return state;
}

function ctxWith(overrides: Partial<RouteContext>): RouteContext {
  return {
    params: {},
    query: new URLSearchParams(),
    body: undefined,
    rawUrl: '/test',
    pathname: '/test',
    method: 'POST',
    headers: {},
    requestId: 'test-req-id',
    ...overrides,
  };
}

describe('parseBody', () => {
  const Schema = z.object({
    email: z.string().min(1),
    age: z.number().optional(),
  });

  it('returns the parsed data for a valid body, unchanged', () => {
    const { res } = fakeRes();
    const ctx = ctxWith({ body: { email: 'a@b.com', age: 30 } });
    const result = parseBody(Schema, ctx, res);
    expect(result).toEqual({ email: 'a@b.com', age: 30 });
  });

  it('allows a valid body without the optional field', () => {
    const { res } = fakeRes();
    const ctx = ctxWith({ body: { email: 'a@b.com' } });
    const result = parseBody(Schema, ctx, res);
    expect(result).toEqual({ email: 'a@b.com' });
  });

  it('rejects a missing required field with 422/VALIDATION_ERROR, mentioning the field', () => {
    const fake = fakeRes();
    const ctx = ctxWith({ body: {} });
    const result = parseBody(Schema, ctx, fake.res);
    expect(result).toBeUndefined();
    expect(fake.statusCode).toBe(422);
    const parsed = JSON.parse(fake.body ?? '{}') as { error: { code: string; message: string } };
    expect(parsed.error.code).toBe('VALIDATION_ERROR');
    expect(parsed.error.message).toContain('email');
  });

  it('rejects a wrong-typed field', () => {
    const fake = fakeRes();
    const ctx = ctxWith({ body: { email: 'a@b.com', age: 'thirty' } });
    const result = parseBody(Schema, ctx, fake.res);
    expect(result).toBeUndefined();
    expect(fake.statusCode).toBe(422);
  });

  it('rejects a completely malformed body (null/non-object) without throwing', () => {
    const fake = fakeRes();
    const ctx = ctxWith({ body: null });
    expect(() => parseBody(Schema, ctx, fake.res)).not.toThrow();
    expect(fake.statusCode).toBe(422);
  });

  it('uses the caller-supplied error override instead of the generic VALIDATION_ERROR shape', () => {
    const fake = fakeRes();
    const ctx = ctxWith({ body: {} });
    const result = parseBody(Schema, ctx, fake.res, {
      status: 400,
      code: 'MISSING_FIELDS',
      message: 'email and password are required',
    });
    expect(result).toBeUndefined();
    expect(fake.statusCode).toBe(400);
    const parsed = JSON.parse(fake.body ?? '{}') as { error: { code: string; message: string } };
    expect(parsed.error.code).toBe('MISSING_FIELDS');
    expect(parsed.error.message).toBe('email and password are required');
  });

  it('never leaks a Zod internal error class or stack in the response body', () => {
    const fake = fakeRes();
    const ctx = ctxWith({ body: {} });
    parseBody(Schema, ctx, fake.res);
    expect(fake.body).not.toContain('ZodError');
    expect(fake.body).not.toContain('at ');
    expect(fake.body).not.toContain('.ts:');
  });
});

describe('parseQuery', () => {
  const Schema = z.object({
    limit: z.coerce.number().int().positive().optional(),
    status: z.enum(['PENDING', 'ACTIVE']).optional(),
  });

  it('coerces a numeric string query param explicitly', () => {
    const { res } = fakeRes();
    const ctx = ctxWith({ query: new URLSearchParams('limit=10') });
    const result = parseQuery(Schema, ctx, res);
    expect(result).toEqual({ limit: 10 });
  });

  it('rejects a non-numeric value for a numeric param instead of silently coercing', () => {
    const fake = fakeRes();
    const ctx = ctxWith({ query: new URLSearchParams('limit=abc') });
    const result = parseQuery(Schema, ctx, fake.res);
    expect(result).toBeUndefined();
    expect(fake.statusCode).toBe(422);
  });

  it('rejects a value outside the declared enum', () => {
    const fake = fakeRes();
    const ctx = ctxWith({ query: new URLSearchParams('status=DELETED') });
    const result = parseQuery(Schema, ctx, fake.res);
    expect(result).toBeUndefined();
    expect(fake.statusCode).toBe(422);
  });

  it('allows an empty query string when every field is optional', () => {
    const { res } = fakeRes();
    const ctx = ctxWith({ query: new URLSearchParams('') });
    const result = parseQuery(Schema, ctx, res);
    expect(result).toEqual({});
  });
});

describe('parseParams', () => {
  const Schema = z.object({ id: z.string().uuid() });

  it('accepts a well-formed UUID path param', () => {
    const { res } = fakeRes();
    const ctx = ctxWith({ params: { id: '550e8400-e29b-41d4-a716-446655440000' } });
    const result = parseParams(Schema, ctx, res);
    expect(result).toEqual({ id: '550e8400-e29b-41d4-a716-446655440000' });
  });

  it('rejects a malformed id instead of passing it through to the store', () => {
    const fake = fakeRes();
    const ctx = ctxWith({ params: { id: 'not-a-uuid' } });
    const result = parseParams(Schema, ctx, fake.res);
    expect(result).toBeUndefined();
    expect(fake.statusCode).toBe(422);
  });
});
