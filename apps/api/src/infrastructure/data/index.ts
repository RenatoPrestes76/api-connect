/**
 * Atlas Data Access Core — composition root.
 *
 * Wires the data-access foundation into a single DI container. Concrete
 * repositories/services built in later sprints register themselves against
 * `repositoryFactory`; nothing domain-specific lives here.
 */
import { SimpleDIContainer } from './di-container.js';
import { RepositoryFactoryImpl } from './factory/repository-factory.js';

export * from './tenant-context.js';
export * from './di-container.js';
export * from './repositories/prisma-delegate.js';
export * from './repositories/base-repository.js';
export * from './unit-of-work/prisma-unit-of-work.js';
export * from './transactions/transaction-manager.js';
export * from './query/query-builder.js';
export * from './pagination/pagination.js';
export * from './factory/repository-factory.js';

/** Token under which the RepositoryFactory singleton is registered. */
export const REPOSITORY_FACTORY_TOKEN = Symbol('RepositoryFactory');

/** Root DI container for the data-access layer — the single composition root. */
export const dataContainer = new SimpleDIContainer();

/** Shared RepositoryFactory instance, backed by `dataContainer`. */
export const repositoryFactory = new RepositoryFactoryImpl(dataContainer);

dataContainer.registerValue(REPOSITORY_FACTORY_TOKEN, repositoryFactory);
