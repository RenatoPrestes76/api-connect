/**
 * Minimal shape BaseRepository needs from a generated Prisma model delegate
 * (e.g. `prisma.organization`). Kept structural and generic on purpose — this
 * foundation sprint defines no concrete entities or delegates; any future
 * repository just passes its own model delegate, which already satisfies
 * this shape without modification.
 */
export interface PrismaModelDelegate<TRow> {
  findFirst(args: { where: Record<string, unknown> }): Promise<TRow | null>;
  findMany(args: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, 'asc' | 'desc'>;
    skip?: number;
    take?: number;
  }): Promise<TRow[]>;
  create(args: { data: Record<string, unknown> }): Promise<TRow>;
  update(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<TRow>;
  delete(args: { where: Record<string, unknown> }): Promise<TRow>;
  count(args?: { where?: Record<string, unknown> }): Promise<number>;
}
