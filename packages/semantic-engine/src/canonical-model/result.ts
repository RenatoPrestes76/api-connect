import type {
  SemanticError,
  SemanticErrorCode,
  SemanticResult,
} from '../business-language/index.js';

export function ok<T>(data: T, startedAt?: number): SemanticResult<T> {
  return {
    success: true,
    data,
    timestamp: new Date(),
    durationMs: startedAt === undefined ? undefined : Date.now() - startedAt,
  };
}

export function err<T = never>(
  code: SemanticErrorCode,
  message: string,
  details?: Record<string, unknown>
): SemanticResult<T> {
  const error: SemanticError = { code, message, details };
  return { success: false, error, timestamp: new Date() };
}
