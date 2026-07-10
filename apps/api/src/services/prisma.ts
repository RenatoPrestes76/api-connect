/**
 * Prisma client singleton for the API service.
 * @prisma/client must be a direct dependency of apps/api.
 * The server boots without a live DB in dev — DB-backed routes fail gracefully.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@prisma/client');
  } catch {
    return { PrismaClient: null };
  }
})();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _prisma: any = null;

function getPrismaClient() {
  if (!PrismaClient) return null;
  if (_prisma) return _prisma;
  const globalForPrisma = globalThis as unknown as { prisma: unknown };
  _prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
      log: process.env['NODE_ENV'] === 'development' ? ['warn', 'error'] : ['error'],
    });
  if (process.env['NODE_ENV'] !== 'production') {
    globalForPrisma.prisma = _prisma;
  }
  return _prisma;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prisma: any = new Proxy({} as any, {
  get(_target, prop) {
    const client = getPrismaClient();
    if (!client)
      throw new Error(
        'Database client unavailable — @prisma/client not installed or not generated'
      );
    return Reflect.get(client, prop);
  },
});

export async function connectDB(): Promise<void> {
  const client = getPrismaClient();
  if (!client) throw new Error('@prisma/client not available');
  await client.$connect();
}

export async function disconnectDB(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
  }
}
