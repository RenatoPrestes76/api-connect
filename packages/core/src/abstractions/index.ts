/**
 * @seltriva/core/abstractions
 * Generic design pattern abstractions — Strategy, Observer, Chain, Decorator, Adapter, etc.
 */

// ─── Strategy Pattern ──────────────────────────────────────────────────────

/**
 * Encapsulates an interchangeable algorithm
 */
export interface Strategy<TInput, TOutput = TInput> {
  execute(input: TInput): Promise<TOutput>;
  getName(): string;
  isApplicable(input: TInput): boolean;
  getPriority(): number;
}

/**
 * Selects and delegates to the correct strategy at runtime
 */
export interface StrategySelector<TInput, TOutput = TInput> {
  select(input: TInput): Strategy<TInput, TOutput> | null;
  register(strategy: Strategy<TInput, TOutput>): void;
  unregister(name: string): void;
  getAll(): Strategy<TInput, TOutput>[];
}

// ─── Chain of Responsibility ────────────────────────────────────────────────

export interface ChainHandler<T> {
  handle(request: T): Promise<T | null>;
  setNext(handler: ChainHandler<T>): ChainHandler<T>;
  getName(): string;
}

// ─── Observer Pattern ───────────────────────────────────────────────────────

export interface Observer<T> {
  update(subject: T): Promise<void>;
  readonly id: string;
}

export interface Observable<T> {
  attach(observer: Observer<T>): void;
  detach(observer: Observer<T>): void;
  notify(): Promise<void>;
  getObserverCount(): number;
}

// ─── Decorator Pattern ──────────────────────────────────────────────────────

export interface Decorator<T> {
  decorate(component: T): T;
  getName(): string;
  getOrder(): number;
}

// ─── Adapter Pattern ────────────────────────────────────────────────────────

export interface Adapter<TSource, TTarget> {
  adapt(source: TSource): TTarget;
  isCompatible(source: TSource): boolean;
}

// ─── Template Method ────────────────────────────────────────────────────────

export interface TemplateMethod {
  execute(): Promise<void>;
  getSteps(): TemplateStep[];
}

export interface TemplateStep {
  readonly name: string;
  readonly execute: () => Promise<void>;
  readonly order: number;
  readonly optional?: boolean;
  readonly errorHandler?: (error: Error) => Promise<void>;
}

// ─── Proxy Pattern ──────────────────────────────────────────────────────────

export interface Proxy<T> {
  getSubject(): T;
  execute<R>(operation: (subject: T) => Promise<R>): Promise<R>;
  addInterceptor(interceptor: ProxyInterceptor): void;
  removeInterceptor(id: string): void;
}

export interface ProxyInterceptor {
  readonly id: string;
  before?(context: ProxyContext): Promise<void>;
  after?(context: ProxyContext, result?: unknown): Promise<void>;
  error?(context: ProxyContext, error: Error): Promise<void>;
}

export interface ProxyContext {
  readonly operation: string;
  readonly args: unknown[];
  readonly timestamp: Date;
}

// ─── Specification Pattern ──────────────────────────────────────────────────

/**
 * Encapsulates a boolean predicate that can be composed
 */
export interface Specification<T> {
  isSatisfiedBy(candidate: T): boolean;
  and(other: Specification<T>): Specification<T>;
  or(other: Specification<T>): Specification<T>;
  not(): Specification<T>;
}

// ─── Unit of Work ───────────────────────────────────────────────────────────

/**
 * Tracks changes and flushes them as a single atomic transaction
 */
export interface UnitOfWork {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  isActive(): boolean;
}

// ─── Repository ─────────────────────────────────────────────────────────────

export interface RepositoryCriteria {
  readonly filters?: Record<string, unknown>;
  readonly orderBy?: string;
  readonly orderDir?: 'asc' | 'desc';
  readonly limit?: number;
  readonly offset?: number;
}
