/** Minimal Prisma delegate shape for ActivationToken — avoids importing the full generated client. */

export interface PrismaActivationToken {
  id:          string;
  token:       string;
  companyId:   string;
  environment: string;
  expiresAt:   Date;
  usedAt:      Date | null;
  createdAt:   Date;
  createdBy:   string | null;
}

export interface ActivationTokenDbDelegate {
  create(args: { data: Omit<PrismaActivationToken, 'createdAt'> & { createdAt?: Date } }): Promise<PrismaActivationToken>;
  upsert(args: { where: { id: string }; create: PrismaActivationToken; update: Partial<PrismaActivationToken> }): Promise<PrismaActivationToken>;
  findUnique(args: { where: { id?: string; token?: string } }): Promise<PrismaActivationToken | null>;
  findMany(args: { where: { companyId?: string } }): Promise<PrismaActivationToken[]>;
  delete(args: { where: { id: string } }): Promise<void>;
}

export interface ActivationDbClient {
  activationToken: ActivationTokenDbDelegate;
}
