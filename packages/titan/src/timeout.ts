import { TimeoutError } from './types.js';

/** Races `fn` against a configurable timeout, rejecting with TimeoutError if it doesn't settle in time. */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  operationName = 'operation'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(operationName, timeoutMs)), timeoutMs);
  });

  try {
    return await Promise.race([fn(), timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

export { TimeoutError } from './types.js';
