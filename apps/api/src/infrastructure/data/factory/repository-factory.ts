/**
 * DI-backed RepositoryFactory, implementing @seltriva/core's existing
 * RepositoryFactory contract. Concrete repositories register themselves here
 * by entity name; resolution goes through the DIContainer so each repository
 * still receives its dependencies via composition, not global state.
 */
import type { DIContainer, RepositoryFactory } from '@seltriva/core';

export class RepositoryNotRegisteredError extends Error {
  readonly code = 'REPOSITORY_NOT_REGISTERED';

  constructor(entityName: string) {
    super(`No repository is registered for entity "${entityName}"`);
    this.name = 'RepositoryNotRegisteredError';
  }
}

export class RepositoryFactoryImpl implements RepositoryFactory {
  constructor(private readonly container: DIContainer) {}

  register(entityName: string, repositoryClass: new () => unknown): void {
    this.container.register(entityName, repositoryClass, { replace: true });
  }

  supports(entityName: string): boolean {
    return this.container.isRegistered(entityName);
  }

  // _TEntity mirrors @seltriva/core's RepositoryFactory signature — the
  // interface's own return type is `unknown`, so callers cast at the call site.
  create<_TEntity>(entityName: string): unknown {
    if (!this.supports(entityName)) {
      throw new RepositoryNotRegisteredError(entityName);
    }
    return this.container.resolve(entityName);
  }
}
