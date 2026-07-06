import { describe, it, expect } from 'vitest';
import { Compressor } from '../compression/compressor.js';

const PAYLOAD = Buffer.from(JSON.stringify({ id: 1, nome: 'Produto Teste', preco: 99.99 }));

describe('Compressor — gzip', () => {
  const c = new Compressor({ enabled: true, algorithm: 'gzip', level: 6 });

  it('compresses data', async () => {
    const result = await c.compress(PAYLOAD);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.algorithm).toBe('gzip');
    }
  });

  it('decompresses back to original', async () => {
    const compressed = await c.compress(PAYLOAD);
    expect(compressed.ok).toBe(true);
    if (compressed.ok) {
      const decompressed = await c.decompress(compressed.value.data, 'gzip');
      expect(decompressed.ok).toBe(true);
      if (decompressed.ok) {
        expect(decompressed.value.toString('utf-8')).toBe(PAYLOAD.toString('utf-8'));
      }
    }
  });

  it('exposes ratio and size metadata', async () => {
    const result = await c.compress(PAYLOAD);
    if (result.ok) {
      expect(result.value.originalSize).toBe(PAYLOAD.length);
      expect(typeof result.value.ratio).toBe('number');
    }
  });
});

describe('Compressor — brotli', () => {
  const c = new Compressor({ enabled: true, algorithm: 'brotli', level: 4 });

  it('compresses data with brotli', async () => {
    const result = await c.compress(PAYLOAD);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.algorithm).toBe('brotli');
  });

  it('decompresses brotli back to original', async () => {
    const compressed = await c.compress(PAYLOAD);
    if (compressed.ok) {
      const decompressed = await c.decompress(compressed.value.data, 'brotli');
      expect(decompressed.ok).toBe(true);
      if (decompressed.ok) {
        expect(decompressed.value.toString('utf-8')).toBe(PAYLOAD.toString('utf-8'));
      }
    }
  });
});

describe('Compressor — disabled (none)', () => {
  it('returns payload unchanged with algorithm=none', async () => {
    const c = new Compressor({ enabled: false, algorithm: 'none', level: 6 });
    const result = await c.compress(PAYLOAD);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.algorithm).toBe('none');
      expect(result.value.data).toEqual(PAYLOAD);
    }
  });

  it('decompresses none algorithm as identity', async () => {
    const c = new Compressor({ enabled: false, algorithm: 'none', level: 6 });
    const result = await c.decompress(PAYLOAD, 'none');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(PAYLOAD);
  });

  it('returns error for unsupported algorithm in decompress', async () => {
    const c = new Compressor({ enabled: true, algorithm: 'gzip', level: 6 });
    const result = await c.decompress(PAYLOAD, 'lz4');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNSUPPORTED_ALGORITHM');
  });

  it('compress returns UNSUPPORTED_ALGORITHM for unknown algorithm', async () => {
    // early-return only fires for 'none'; 'zstd' falls through to the else branch
    const c = new Compressor({ enabled: true, algorithm: 'zstd' as unknown as 'gzip', level: 6 });
    const result = await c.compress(PAYLOAD);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNSUPPORTED_ALGORITHM');
  });

  it('decompress returns DECOMPRESSION_FAILED for corrupted gzip data', async () => {
    const c = new Compressor({ enabled: true, algorithm: 'gzip', level: 6 });
    const corrupted = Buffer.from('this is definitely not gzip data at all');
    const result = await c.decompress(corrupted, 'gzip');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('DECOMPRESSION_FAILED');
  });
});
