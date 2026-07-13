import { prisma } from './prisma.js';
import type { AgentStatus } from '@prisma/client';

export interface RegisterAgentInput {
  organizationId: string;
  environmentId: string;
  name: string;
  version: string;
  hostname?: string;
  ipAddress?: string;
  platform?: string;
  arch?: string;
  nodeVersion?: string;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

export interface HeartbeatInput {
  agentId: string;
  status: AgentStatus;
  cpuPct?: number;
  memPct?: number;
  diskPct?: number;
  latencyMs?: number;
  version?: string;
  metadata?: Record<string, unknown>;
}

export interface ListAgentsFilter {
  organizationId?: string;
  environmentId?: string;
  status?: AgentStatus;
  page?: number;
  pageSize?: number;
}

export const AgentService = {
  async findById(id: string) {
    return prisma.agent.findFirst({
      where: { id, retiredAt: null },
      include: {
        environment: { select: { id: true, name: true, kind: true } },
        organization: { select: { id: true, name: true, slug: true } },
      },
    });
  },

  async list({
    organizationId,
    environmentId,
    status,
    page = 1,
    pageSize = 20,
  }: ListAgentsFilter = {}) {
    const where = {
      retiredAt: null,
      ...(organizationId && { organizationId }),
      ...(environmentId && { environmentId }),
      ...(status && { status }),
    };

    const [items, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { lastSeenAt: 'desc' },
        include: {
          environment: { select: { id: true, name: true, kind: true } },
          _count: { select: { heartbeats: true } },
        },
      }),
      prisma.agent.count({ where }),
    ]);

    return { items, total };
  },

  async register(input: RegisterAgentInput) {
    return prisma.agent.create({
      data: {
        organizationId: input.organizationId,
        environmentId: input.environmentId,
        name: input.name,
        version: input.version,
        status: 'OFFLINE',
        hostname: input.hostname,
        ipAddress: input.ipAddress,
        platform: input.platform,
        arch: input.arch,
        nodeVersion: input.nodeVersion,
        capabilities: input.capabilities ?? [],
        metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
        registeredAt: new Date(),
      },
    });
  },

  async heartbeat(input: HeartbeatInput) {
    const [agent] = await Promise.all([
      prisma.agent.update({
        where: { id: input.agentId },
        data: {
          status: input.status,
          lastSeenAt: new Date(),
          ...(input.version && { version: input.version }),
        },
      }),
      prisma.agentHeartbeat.create({
        data: {
          agentId: input.agentId,
          status: input.status,
          cpuPct: input.cpuPct,
          memPct: input.memPct,
          diskPct: input.diskPct,
          latencyMs: input.latencyMs,
          version: input.version,
          metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
        },
      }),
    ]);

    return agent;
  },

  async getRecentHeartbeats(agentId: string, limit = 10) {
    return prisma.agentHeartbeat.findMany({
      where: { agentId },
      orderBy: { receivedAt: 'desc' },
      take: limit,
    });
  },

  async retire(agentId: string) {
    return prisma.agent.update({
      where: { id: agentId },
      data: { status: 'RETIRED', retiredAt: new Date() },
    });
  },
};
