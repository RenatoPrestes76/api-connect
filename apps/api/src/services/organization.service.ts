import { prisma } from './prisma.js';
import type { OrganizationTier, OrganizationStatus } from '@prisma/client';

export interface CreateOrganizationInput {
  slug: string;
  name: string;
  tier?: OrganizationTier;
}

export interface UpdateOrganizationInput {
  name?: string;
  tier?: OrganizationTier;
  status?: OrganizationStatus;
  logoUrl?: string;
  settings?: Record<string, unknown>;
}

export interface ListOrganizationsFilter {
  page?: number;
  pageSize?: number;
  search?: string;
  tier?: OrganizationTier;
  status?: OrganizationStatus;
}

export const OrganizationService = {
  async findById(id: string) {
    return prisma.organization.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: { members: true, workspaces: true, agents: true },
        },
      },
    });
  },

  async findBySlug(slug: string) {
    return prisma.organization.findFirst({
      where: { slug, deletedAt: null },
    });
  },

  async list({ page = 1, pageSize = 20, search, tier, status }: ListOrganizationsFilter = {}) {
    const where = {
      deletedAt: null,
      ...(tier && { tier }),
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { slug: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { members: true, workspaces: true, agents: true } },
        },
      }),
      prisma.organization.count({ where }),
    ]);

    return { items, total };
  },

  async create(input: CreateOrganizationInput) {
    return prisma.organization.create({
      data: {
        slug: input.slug,
        name: input.name,
        tier: input.tier ?? 'FREE',
        status: 'ACTIVE',
      },
    });
  },

  async update(id: string, input: UpdateOrganizationInput) {
    return prisma.organization.update({
      where: { id },
      data: {
        ...input,
        settings: input.settings ? JSON.stringify(input.settings) : undefined,
        updatedAt: new Date(),
      },
    });
  },

  async softDelete(id: string) {
    return prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'DELETED' },
    });
  },

  async getWorkspaces(organizationId: string) {
    return prisma.workspace.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  },

  async getMembers(organizationId: string) {
    return prisma.organizationMember.findMany({
      where: { organizationId, deletedAt: null },
      include: { user: { select: { id: true, email: true, displayName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
  },
};
