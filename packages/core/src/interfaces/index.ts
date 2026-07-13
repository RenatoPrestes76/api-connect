/**
 * @seltriva/core/interfaces
 * Core domain interfaces — Domain-Driven Design (DDD) + Dependency Injection (DI)
 */

// ─── Value Objects & Entities ───────────────────────────────────────────────

/**
 * Immutable value object — identity determined by attributes, not id
 */
export interface ValueObject<T> {
  equals(other: T): boolean;
  toString(): string;
}

/**
 * Domain entity — has a unique identity that persists over time
 */
export interface Entity<TId = string> {
  readonly id: TId;
  equals(other: Entity<TId>): boolean;
}

/**
 * Aggregate root — consistency boundary; events are raised here
 */
export interface AggregateRoot<TId = string> extends Entity<TId> {
  readonly domainEvents: DomainEvent[];
  addDomainEvent(event: DomainEvent): void;
  clearDomainEvents(): void;
  getVersion(): number;
}

// ─── Domain Events ──────────────────────────────────────────────────────────

/**
 * An event that occurred within the domain
 */
export interface DomainEvent {
  readonly id: string;
  readonly type: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly version: number;
  readonly occurredAt: Date;
  readonly metadata?: Record<string, unknown>;
}

// ─── Repository ─────────────────────────────────────────────────────────────

/**
 * Collection-like abstraction for aggregate persistence
 */
export interface Repository<TEntity extends Entity, TId = string> {
  findById(id: TId): Promise<TEntity | null>;
  findAll(criteria?: RepositoryCriteria): Promise<TEntity[]>;
  save(entity: TEntity): Promise<void>;
  delete(id: TId): Promise<void>;
  exists(id: TId): Promise<boolean>;
  count(criteria?: RepositoryCriteria): Promise<number>;
}

/**
 * Query filter / sort / pagination options for repository lookups
 */
export interface RepositoryCriteria {
  readonly filters?: Record<string, unknown>;
  readonly orderBy?: string;
  readonly orderDir?: 'asc' | 'desc';
  readonly limit?: number;
  readonly offset?: number;
}

// ─── Unit of Work ───────────────────────────────────────────────────────────

/**
 * Transaction boundary — groups multiple repository operations atomically
 */
export interface UnitOfWork {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  isActive(): boolean;
}

// ─── Specification ──────────────────────────────────────────────────────────

/**
 * Composable boolean predicate — encapsulates business rules
 */
export interface Specification<T> {
  isSatisfiedBy(candidate: T): boolean;
  and(other: Specification<T>): Specification<T>;
  or(other: Specification<T>): Specification<T>;
  not(): Specification<T>;
}

// ─── Domain Service ─────────────────────────────────────────────────────────

/**
 * Stateless domain operation that doesn't belong on any single entity
 */
export interface DomainService {
  readonly serviceName: string;
}

// ─── Dependency Injection ───────────────────────────────────────────────────

/**
 * Inversion-of-Control container — the composition root
 */
export interface DIContainer {
  register<T>(
    token: string | symbol,
    implementation: new (...args: unknown[]) => T,
    options?: DIRegistrationOptions
  ): void;
  registerValue<T>(token: string | symbol, value: T): void;
  registerFactory<T>(token: string | symbol, factory: () => T | Promise<T>): void;
  resolve<T>(token: string | symbol): T;
  resolveAsync<T>(token: string | symbol): Promise<T>;
  isRegistered(token: string | symbol): boolean;
  unregister(token: string | symbol): void;
  createScope(): DIContainer;
}

/**
 * Options for registering a service in the DI container
 */
export interface DIRegistrationOptions {
  readonly scope?: 'singleton' | 'transient' | 'request';
  readonly tags?: string[];
  readonly replace?: boolean;
}

/**
 * Service locator — anti-pattern fallback, use only at composition boundaries
 */
export interface ServiceLocator {
  get<T>(token: string | symbol): T;
  getOptional<T>(token: string | symbol): T | null;
  has(token: string | symbol): boolean;
}
