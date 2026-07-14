/**
 * Prisma-backed UnitOfWork. Bridges Prisma's callback-style `$transaction`
 * into the explicit begin/commit/rollback shape @seltriva/core's UnitOfWork
 * interface expects, by holding a deferred promise open until commit() or
 * rollback() releases it.
 */
import type { UnitOfWork } from '@seltriva/core';

export type TransactionClient = Record<string, unknown>;

export interface TransactionalPrismaClient {
  $transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T>;
}

export class UnitOfWorkStateError extends Error {
  readonly code = 'UNIT_OF_WORK_INVALID_STATE';

  constructor(message: string) {
    super(message);
    this.name = 'UnitOfWorkStateError';
  }
}

export class PrismaUnitOfWork implements UnitOfWork {
  private tx: TransactionClient | undefined;
  private release: ((error?: unknown) => void) | undefined;
  private settledPromise: Promise<void> | undefined;

  constructor(private readonly prisma: TransactionalPrismaClient) {}

  isActive(): boolean {
    return this.tx !== undefined;
  }

  async begin(): Promise<void> {
    if (this.isActive()) {
      throw new UnitOfWorkStateError('Unit of work is already active');
    }

    let markReady: () => void = () => undefined;
    const ready = new Promise<void>((resolve) => {
      markReady = resolve;
    });

    this.settledPromise = this.prisma.$transaction((tx) => {
      this.tx = tx;
      return new Promise<void>((resolve, reject) => {
        this.release = (error) => (error ? reject(error) : resolve());
        markReady();
      });
    });

    await ready;
  }

  /** The active transaction client — repositories participating in this unit of work use this. */
  getTransactionClient(): TransactionClient {
    if (!this.tx) {
      throw new UnitOfWorkStateError('Unit of work is not active');
    }
    return this.tx;
  }

  async commit(): Promise<void> {
    if (!this.isActive() || !this.release || !this.settledPromise) {
      throw new UnitOfWorkStateError('Unit of work is not active');
    }
    this.release();
    await this.settledPromise;
    this.reset();
  }

  async rollback(): Promise<void> {
    if (!this.isActive() || !this.release || !this.settledPromise) {
      throw new UnitOfWorkStateError('Unit of work is not active');
    }
    this.release(new Error('Unit of work rolled back'));
    try {
      await this.settledPromise;
    } catch {
      // Expected — the transaction promise rejects when rolled back.
    }
    this.reset();
  }

  private reset(): void {
    this.tx = undefined;
    this.release = undefined;
    this.settledPromise = undefined;
  }
}
