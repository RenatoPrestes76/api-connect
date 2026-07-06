/**
 * Minimal Prisma model types for agent-provisioning.
 *
 * These mirror what `prisma generate` produces for the AtlasAgent,
 * ProvisioningToken, and AgentAccessToken models in schema.prisma.
 *
 * After any schema change, run:
 *   pnpm --filter @seltriva/database db:generate
 */

// ─── AtlasAgent ──────────────────────────────────────────────────────────────

export interface PrismaAtlasAgent {
  id:                  string;
  companyId:           string;
  name:                string;
  machineId:           string;
  hostname:            string;
  connectorType:       string;
  version:             string;
  status:              string;
  lastHeartbeat:       Date | null;
  lastSynchronization: Date | null;
  createdAt:           Date;
  updatedAt:           Date;
  deletedAt:           Date | null;
}

export type PrismaAtlasAgentCreate = Omit<PrismaAtlasAgent, 'createdAt' | 'updatedAt'>;
export type PrismaAtlasAgentUpdate = Partial<Omit<PrismaAtlasAgent, 'id' | 'createdAt'>>;

export interface AgentDbDelegate {
  create(args: { data: PrismaAtlasAgentCreate }): Promise<PrismaAtlasAgent>;
  update(args: { where: { id: string }; data: PrismaAtlasAgentUpdate }): Promise<PrismaAtlasAgent>;
  findUnique(args: {
    where: { id?: string; machineId?: string };
  }): Promise<PrismaAtlasAgent | null>;
  findMany(args: {
    where?: {
      companyId?: string;
      status?: string;
      deletedAt?: null;
    };
  }): Promise<PrismaAtlasAgent[]>;
  updateMany(args: {
    where: { id: string };
    data: { deletedAt: Date };
  }): Promise<{ count: number }>;
}

// ─── ProvisioningToken ───────────────────────────────────────────────────────

export interface PrismaProvisioningToken {
  id:          string;
  companyId:   string;
  tokenHash:   string;
  tokenPrefix: string;
  description: string;
  expiresAt:   Date;
  revokedAt:   Date | null;
  lastUsedAt:  Date | null;
  createdAt:   Date;
  updatedAt:   Date;
}

export type PrismaProvisioningTokenCreate = Omit<PrismaProvisioningToken, 'createdAt' | 'updatedAt'>;
export type PrismaProvisioningTokenUpdate = Partial<Omit<PrismaProvisioningToken, 'id' | 'createdAt'>>;

export interface ProvisioningTokenDbDelegate {
  create(args: { data: PrismaProvisioningTokenCreate }): Promise<PrismaProvisioningToken>;
  update(args: {
    where: { id: string };
    data: PrismaProvisioningTokenUpdate;
  }): Promise<PrismaProvisioningToken>;
  findUnique(args: {
    where: { tokenHash?: string; id?: string };
  }): Promise<PrismaProvisioningToken | null>;
  findMany(args: {
    where?: {
      companyId?: string;
      tokenPrefix?: string;
      revokedAt?: null;
      expiresAt?: { gt: Date };
    };
  }): Promise<PrismaProvisioningToken[]>;
}

// ─── AgentAccessToken ────────────────────────────────────────────────────────

export interface PrismaAgentAccessToken {
  id:          string;
  agentId:     string;
  tokenHash:   string;
  tokenPrefix: string;
  expiresAt:   Date;
  revokedAt:   Date | null;
  lastUsedAt:  Date | null;
  createdAt:   Date;
  updatedAt:   Date;
}

export type PrismaAgentAccessTokenCreate = Omit<PrismaAgentAccessToken, 'createdAt' | 'updatedAt'>;
export type PrismaAgentAccessTokenUpdate = Partial<Omit<PrismaAgentAccessToken, 'id' | 'createdAt'>>;

export interface AgentAccessTokenDbDelegate {
  create(args: { data: PrismaAgentAccessTokenCreate }): Promise<PrismaAgentAccessToken>;
  update(args: {
    where: { id: string };
    data: PrismaAgentAccessTokenUpdate;
  }): Promise<PrismaAgentAccessToken>;
  findUnique(args: {
    where: { tokenHash?: string; id?: string };
  }): Promise<PrismaAgentAccessToken | null>;
  findMany(args: {
    where?: { agentId?: string };
  }): Promise<PrismaAgentAccessToken[]>;
}

// ─── Combined client interface ────────────────────────────────────────────────

export interface AgentProvisioningDbClient {
  atlasAgent:        AgentDbDelegate;
  provisioningToken: ProvisioningTokenDbDelegate;
  agentAccessToken:  AgentAccessTokenDbDelegate;
}
