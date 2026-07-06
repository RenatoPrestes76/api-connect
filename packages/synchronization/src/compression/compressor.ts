/**
 * Compressor — gzip and brotli compression using Node.js built-in zlib.
 *
 * Compression is async and streaming-friendly.
 * Decompression is included for testing / verification.
 */
import { gzip, gunzip, brotliCompress, brotliDecompress, constants } from 'zlib';
import { promisify } from 'util';
import type { CompressionConfig, SyncResult } from '../types/index.js';
import { syncOk, syncFail } from '../types/index.js';

const gzipAsync         = promisify(gzip);
const gunzipAsync       = promisify(gunzip);
const brotliCompressAsync   = promisify(brotliCompress);
const brotliDecompressAsync = promisify(brotliDecompress);

export interface CompressResult {
  readonly data:           Buffer;
  readonly algorithm:      string;
  readonly originalSize:   number;
  readonly compressedSize: number;
  readonly ratio:          number;
}

export class Compressor {
  constructor(private readonly _config: CompressionConfig) {}

  async compress(input: Buffer | string): Promise<SyncResult<CompressResult>> {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf-8');

    if (!this._config.enabled || this._config.algorithm === 'none') {
      return syncOk({
        data:           buf,
        algorithm:      'none',
        originalSize:   buf.length,
        compressedSize: buf.length,
        ratio:          1,
      });
    }

    try {
      let compressed: Buffer;

      if (this._config.algorithm === 'gzip') {
        compressed = await gzipAsync(buf, { level: this._config.level });
      } else if (this._config.algorithm === 'brotli') {
        compressed = await brotliCompressAsync(buf, {
          params: { [constants.BROTLI_PARAM_QUALITY]: this._config.level },
        });
      } else {
        return syncFail('UNSUPPORTED_ALGORITHM', `Unsupported compression: ${this._config.algorithm as string}`);
      }

      return syncOk({
        data:           compressed,
        algorithm:      this._config.algorithm,
        originalSize:   buf.length,
        compressedSize: compressed.length,
        ratio:          buf.length > 0 ? compressed.length / buf.length : 1,
      });
    } catch (err) {
      return syncFail('COMPRESSION_FAILED', `Compression failed: ${(err as Error).message}`, {
        cause: err as Error,
      });
    }
  }

  async decompress(input: Buffer, algorithm: string): Promise<SyncResult<Buffer>> {
    try {
      if (algorithm === 'gzip') {
        return syncOk(await gunzipAsync(input));
      } else if (algorithm === 'brotli') {
        return syncOk(await brotliDecompressAsync(input));
      } else if (algorithm === 'none') {
        return syncOk(input);
      }
      return syncFail('UNSUPPORTED_ALGORITHM', `Unsupported decompression: ${algorithm}`);
    } catch (err) {
      return syncFail('DECOMPRESSION_FAILED', `Decompression failed: ${(err as Error).message}`, {
        cause: err as Error,
      });
    }
  }
}
