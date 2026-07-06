import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClientError, api } from '@/services/api-client';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeResponse(body: unknown, status = 200): Response {
  return {
    ok:     status >= 200 && status < 300,
    status,
    json:   () => Promise.resolve(body),
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ApiClientError', () => {
  it('sets status, code and message', () => {
    const err = new ApiClientError(404, 'NOT_FOUND', 'Not found');
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Not found');
    expect(err.name).toBe('ApiClientError');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('api.get', () => {
  it('calls fetch with GET and returns parsed body', async () => {
    mockFetch.mockResolvedValue(makeResponse({ items: [1, 2] }));
    const result = await api.get<{ items: number[] }>('/path');
    expect(result).toEqual({ items: [1, 2] });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/path'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('throws ApiClientError on non-OK response', async () => {
    mockFetch.mockResolvedValue(makeResponse(
      { error: { code: 'NOT_FOUND', message: 'Resource not found' } },
      404,
    ));
    await expect(api.get('/path')).rejects.toThrow(ApiClientError);
    await expect(api.get('/path')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('falls back to generic message on malformed error body', async () => {
    mockFetch.mockResolvedValue({
      ok: false, status: 500,
      json: () => Promise.reject(new Error('not json')),
    } as unknown as Response);
    await expect(api.get('/path')).rejects.toMatchObject({ code: 'HTTP_ERROR', status: 500 });
  });
});

describe('api.post', () => {
  it('sends JSON body', async () => {
    mockFetch.mockResolvedValue(makeResponse({ id: '1' }, 201));
    const result = await api.post<{ id: string }>('/path', { name: 'test' });
    expect(result).toEqual({ id: '1' });
    const call = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(call[1].method).toBe('POST');
    expect(call[1].body).toBe('{"name":"test"}');
  });

  it('sends no body when undefined', async () => {
    mockFetch.mockResolvedValue(makeResponse({ ok: true }));
    await api.post('/path');
    const call = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(call[1].body).toBeUndefined();
  });
});

describe('api.put', () => {
  it('sends PUT method', async () => {
    mockFetch.mockResolvedValue(makeResponse({}));
    await api.put('/path', { x: 1 });
    expect((mockFetch.mock.calls[0] as [string, RequestInit])[1].method).toBe('PUT');
  });
});

describe('api.patch', () => {
  it('sends PATCH method', async () => {
    mockFetch.mockResolvedValue(makeResponse({}));
    await api.patch('/path', { x: 1 });
    expect((mockFetch.mock.calls[0] as [string, RequestInit])[1].method).toBe('PATCH');
  });
});

describe('api.delete', () => {
  it('handles 204 No Content', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204, json: vi.fn() } as unknown as Response);
    const result = await api.delete('/path');
    expect(result).toBeUndefined();
  });

  it('sends DELETE method', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204, json: vi.fn() } as unknown as Response);
    await api.delete('/path');
    expect((mockFetch.mock.calls[0] as [string, RequestInit])[1].method).toBe('DELETE');
  });
});

describe('credentials and headers', () => {
  it('includes credentials include', async () => {
    mockFetch.mockResolvedValue(makeResponse({}));
    await api.get('/path');
    expect((mockFetch.mock.calls[0] as [string, RequestInit])[1].credentials).toBe('include');
  });

  it('includes X-Hub-Client header', async () => {
    mockFetch.mockResolvedValue(makeResponse({}));
    await api.get('/path');
    const headers = (mockFetch.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers['X-Hub-Client']).toBe('atlas-hub/1.0');
  });
});
