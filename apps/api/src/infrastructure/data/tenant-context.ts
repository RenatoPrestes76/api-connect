/**
 * Ambient tenant scope for the data-access layer.
 *
 * Every repository call resolves its tenant from here via Node's native
 * AsyncLocalStorage — the same "flows through the async call chain without
 * being threaded through every signature" mechanism .NET's AsyncLocal<T> /
 * IHttpContextAccessor provide natively. No default tenant is ever assumed:
 * if no context is active, resolution throws.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext {
  readonly tenantId: string;
}

export class MissingTenantContextError extends Error {
  readonly code = 'TENANT_CONTEXT_REQUIRED';

  constructor() {
    super('No TenantContext is active — every data-access call must run within a tenant scope');
    this.name = 'MissingTenantContextError';
  }
}

const storage = new AsyncLocalStorage<TenantContext>();

/** Runs `fn` with `tenantId` bound as the ambient tenant for its entire async call chain. */
export function runWithTenantContext<T>(tenantId: string, fn: () => T): T {
  if (!tenantId) {
    throw new MissingTenantContextError();
  }
  return storage.run({ tenantId }, fn);
}

/** Resolves the active TenantContext. Throws MissingTenantContextError if none is bound. */
export function getTenantContext(): TenantContext {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new MissingTenantContextError();
  }
  return ctx;
}

/** True if a TenantContext is currently active — lets call sites branch without throwing. */
export function hasTenantContext(): boolean {
  return storage.getStore() !== undefined;
}
