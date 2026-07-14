/**
 * Ergonomic wrapper over PrismaUnitOfWork: runs `work` inside begin/commit,
 * rolling back automatically if it throws. Pure transaction plumbing — no
 * business logic lives here.
 */
import {
  PrismaUnitOfWork,
  type TransactionalPrismaClient,
} from '../unit-of-work/prisma-unit-of-work.js';

export class TransactionManager {
  constructor(private readonly prisma: TransactionalPrismaClient) {}

  async run<T>(work: (uow: PrismaUnitOfWork) => Promise<T>): Promise<T> {
    const uow = new PrismaUnitOfWork(this.prisma);
    await uow.begin();
    try {
      const result = await work(uow);
      await uow.commit();
      return result;
    } catch (error) {
      await uow.rollback();
      throw error;
    }
  }
}
