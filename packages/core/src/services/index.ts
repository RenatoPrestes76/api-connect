/**
 * @seltriva/core/services
 * Service-layer interfaces — Middleware, Pipelines, Interceptors
 */

// ─── Middleware ─────────────────────────────────────────────────────────────

/**
 * Generic middleware in a request/response pipeline
 */
export interface Middleware<TRequest, TResponse> {
  handle(
    request: TRequest,
    next: (req: TRequest) => Promise<TResponse>
  ): Promise<TResponse>;
  readonly order: number;
  readonly name: string;
  shouldExecute?(request: TRequest): boolean;
}

/**
 * Generic request context flowing through middleware
 */
export interface RequestContext {
  readonly id: string;
  readonly timestamp: Date;
  readonly metadata: Record<string, unknown>;
  readonly data: Record<string, unknown>;
}

/**
 * Generic response context
 */
export interface ResponseContext {
  readonly id: string;
  readonly requestId: string;
  readonly status: number;
  readonly data?: unknown;
  readonly error?: Error;
  readonly timestamp: Date;
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

/**
 * Ordered pipeline of middleware — compose cross-cutting concerns
 */
export interface Pipeline<TRequest, TResponse> {
  use(middleware: Middleware<TRequest, TResponse>): Pipeline<TRequest, TResponse>;
  execute(request: TRequest): Promise<TResponse>;
  getMiddleware(): Middleware<TRequest, TResponse>[];
  clear(): void;
  clone(): Pipeline<TRequest, TResponse>;
}

// ─── Interceptors ───────────────────────────────────────────────────────────

/**
 * Pre/post-process interceptor for any typed value
 */
export interface Interceptor<T> {
  preProcess?(input: T): Promise<T>;
  postProcess?(output: T): Promise<T>;
  handleError?(error: Error): Promise<Error>;
  getPriority(): number;
  getName(): string;
}

/**
 * Ordered chain of interceptors applied sequentially
 */
export interface InterceptorChain<T> {
  addInterceptor(interceptor: Interceptor<T>): void;
  removeInterceptor(name: string): void;
  execute(input: T): Promise<T>;
  getInterceptors(): Interceptor<T>[];
  clear(): void;
}

/**
 * Handles specific error types — single-responsibility error boundary
 */
export interface ErrorInterceptor {
  handle(error: Error, context?: Record<string, unknown>): Promise<Error>;
  getErrorType(): new (...args: unknown[]) => Error;
  getPriority(): number;
}

/**
 * Middleware that specialises in error handling
 */
export interface ErrorMiddleware<TRequest, TResponse> extends Middleware<TRequest, TResponse> {
  handleError(error: Error, request: TRequest): Promise<TResponse>;
  getSupportedErrors(): (new (...args: unknown[]) => Error)[];
}

// ─── Health Check ───────────────────────────────────────────────────────────

export interface HealthCheck {
  check(): Promise<HealthCheckResult>;
  getName(): string;
}

export interface HealthCheckResult {
  readonly name: string;
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly message?: string;
  readonly details?: Record<string, unknown>;
  readonly timestamp: Date;
}

export interface HealthCheckRegistry {
  register(check: HealthCheck): void;
  unregister(name: string): void;
  runAll(): Promise<HealthCheckResult[]>;
  getOverallStatus(): Promise<'healthy' | 'degraded' | 'unhealthy'>;
}

// ─── Logger Interface ───────────────────────────────────────────────────────

/**
 * Structured logger contract used throughout the core
 */
export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): Logger;
}
