/**
 * Minimal, dependency-free IoC container implementing @seltriva/core's
 * DIContainer — the composition root for the data-access layer. This is the
 * TS analogue of .NET's built-in Microsoft.Extensions.DependencyInjection
 * container: no reflection, no decorators, just explicit registration.
 */
import type { DIContainer, DIRegistrationOptions, DIException } from '@seltriva/core';

type Ctor<T> = new (...args: unknown[]) => T;
type FactoryFn<T> = () => T | Promise<T>;

interface ClassRegistration<T> {
  readonly kind: 'class';
  readonly ctor: Ctor<T>;
  readonly options: DIRegistrationOptions | undefined;
  instance: T | undefined;
}

interface ValueRegistration<T> {
  readonly kind: 'value';
  readonly value: T;
}

interface FactoryRegistration<T> {
  readonly kind: 'factory';
  readonly factory: FactoryFn<T>;
}

type Registration<T = unknown> =
  | ClassRegistration<T>
  | ValueRegistration<T>
  | FactoryRegistration<T>;

export class DIResolutionError extends Error implements DIException {
  readonly code: DIException['code'] = 'DI_NOT_FOUND';

  constructor(token: string | symbol) {
    super(`No registration found for token "${String(token)}"`);
    this.name = 'DIResolutionError';
  }
}

export class DIAlreadyRegisteredError extends Error implements DIException {
  readonly code: DIException['code'] = 'DI_ALREADY_REGISTERED';

  constructor(token: string | symbol) {
    super(`Token "${String(token)}" is already registered`);
    this.name = 'DIAlreadyRegisteredError';
  }
}

export class SimpleDIContainer implements DIContainer {
  private readonly registrations = new Map<string | symbol, Registration>();

  constructor(private readonly parent?: SimpleDIContainer) {}

  register<T>(
    token: string | symbol,
    implementation: new (...args: unknown[]) => T,
    options?: DIRegistrationOptions
  ): void {
    this.assertRegisterable(token, options);
    const registration: ClassRegistration<T> = {
      kind: 'class',
      ctor: implementation,
      options,
      instance: undefined,
    };
    this.registrations.set(token, registration as Registration);
  }

  registerValue<T>(token: string | symbol, value: T): void {
    const registration: ValueRegistration<T> = { kind: 'value', value };
    this.registrations.set(token, registration as Registration);
  }

  registerFactory<T>(token: string | symbol, factory: () => T | Promise<T>): void {
    this.assertRegisterable(token);
    const registration: FactoryRegistration<T> = { kind: 'factory', factory };
    this.registrations.set(token, registration as Registration);
  }

  resolve<T>(token: string | symbol): T {
    const registration = this.find(token);
    if (!registration) {
      throw new DIResolutionError(token);
    }
    return this.instantiate<T>(registration);
  }

  async resolveAsync<T>(token: string | symbol): Promise<T> {
    const registration = this.find(token);
    if (!registration) {
      throw new DIResolutionError(token);
    }
    return this.instantiate<T>(registration);
  }

  isRegistered(token: string | symbol): boolean {
    return this.find(token) !== undefined;
  }

  unregister(token: string | symbol): void {
    this.registrations.delete(token);
  }

  createScope(): DIContainer {
    return new SimpleDIContainer(this);
  }

  private find(token: string | symbol): Registration | undefined {
    return this.registrations.get(token) ?? this.parent?.find(token);
  }

  private assertRegisterable(token: string | symbol, options?: DIRegistrationOptions): void {
    if (this.registrations.has(token) && !options?.replace) {
      throw new DIAlreadyRegisteredError(token);
    }
  }

  private instantiate<T>(registration: Registration): T {
    if (registration.kind === 'value') {
      return registration.value as T;
    }

    if (registration.kind === 'class') {
      if (registration.options?.scope === 'singleton') {
        if (registration.instance === undefined) {
          registration.instance = new registration.ctor();
        }
        return registration.instance as T;
      }
      return new registration.ctor() as T;
    }

    return registration.factory() as T;
  }
}
