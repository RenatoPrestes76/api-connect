import type {
  SupportTicket,
  SupportSeverity,
  SupportStatus,
  SupportCategory,
  ApiKey,
  ApiKeyWithSecret,
  OnboardingProgress,
  OnboardingStep,
  PortalDashboard,
  PortalConnector,
  ConnectorHealth,
  PortalUser,
  UserRole,
} from '@seltriva/release';

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function isoNow(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

const SLA_HOURS: Record<SupportSeverity, number> = {
  P1: 1,
  P2: 4,
  P3: 24,
  P4: 72,
};

const ONBOARDING_ORDER: OnboardingStep[] = [
  'cadastro',
  'provisionamento',
  'conector',
  'primeiro_workflow',
  'primeira_execucao',
  'producao',
];

function pct(completed: OnboardingStep[]): number {
  return Math.round((completed.length / ONBOARDING_ORDER.length) * 100);
}

export class PortalStore {
  private tickets: Map<string, SupportTicket> = new Map();
  private apiKeys: Map<string, ApiKey> = new Map();
  private onboarding: Map<string, OnboardingProgress> = new Map();
  private connectors: Map<string, PortalConnector> = new Map();
  private users: Map<string, PortalUser> = new Map();

  constructor() {
    this.seed();
  }

  private seed(): void {
    // ─── Support Tickets ─────────────────────────────────────────────────────
    const tickets: SupportTicket[] = [
      {
        id: 'tkt-001',
        tenantId: 'tenant-enterprise',
        title: 'Workflow execution timeout after 30s on large payloads',
        description: 'Production workflow fails with timeout when processing > 5MB payloads.',
        severity: 'P2',
        status: 'in_progress',
        category: 'technical',
        assignedTo: 'support-tier2@seltriva.com',
        createdAt: isoNow(-3),
        updatedAt: isoNow(-1),
        resolvedAt: null,
        slaTargetHours: SLA_HOURS['P2'],
      },
      {
        id: 'tkt-002',
        tenantId: 'tenant-enterprise',
        title: 'Invoice download generates corrupted PDF',
        description: 'Downloading invoice INV-006 results in a 0-byte PDF file.',
        severity: 'P3',
        status: 'open',
        category: 'billing',
        assignedTo: null,
        createdAt: isoNow(-1),
        updatedAt: isoNow(-1),
        resolvedAt: null,
        slaTargetHours: SLA_HOURS['P3'],
      },
      {
        id: 'tkt-003',
        tenantId: 'tenant-professional',
        title: 'MySQL connector losing connection after 1 hour idle',
        description: 'Connection pool timeout not properly recovering in professional tier.',
        severity: 'P2',
        status: 'resolved',
        category: 'integration',
        assignedTo: 'support-tier2@seltriva.com',
        createdAt: isoNow(-7),
        updatedAt: isoNow(-5),
        resolvedAt: isoNow(-5),
        slaTargetHours: SLA_HOURS['P2'],
      },
      {
        id: 'tkt-004',
        tenantId: 'tenant-enterprise',
        title: 'SSO login loop after session expiry',
        description: 'OIDC redirect loop when session expires with Entra ID.',
        severity: 'P1',
        status: 'resolved',
        category: 'security',
        assignedTo: 'support-tier1@seltriva.com',
        createdAt: isoNow(-14),
        updatedAt: isoNow(-13),
        resolvedAt: isoNow(-13),
        slaTargetHours: SLA_HOURS['P1'],
      },
      {
        id: 'tkt-005',
        tenantId: 'tenant-professional',
        title: 'How to configure ERP provider discovery interval?',
        description: 'Need guidance on adjusting the discovery polling interval.',
        severity: 'P4',
        status: 'closed',
        category: 'technical',
        assignedTo: 'support-tier3@seltriva.com',
        createdAt: isoNow(-10),
        updatedAt: isoNow(-9),
        resolvedAt: isoNow(-9),
        slaTargetHours: SLA_HOURS['P4'],
      },
    ];
    for (const t of tickets) this.tickets.set(t.id, t);

    // ─── API Keys ─────────────────────────────────────────────────────────────
    const keys: ApiKey[] = [
      {
        id: 'key-001',
        tenantId: 'tenant-enterprise',
        name: 'Production Integration',
        prefix: 'atl_prod',
        scopes: ['read:workflows', 'write:workflows', 'read:connectors', 'write:events'],
        createdAt: isoNow(-90),
        lastUsedAt: isoNow(-1),
        expiresAt: isoNow(275),
        active: true,
        createdBy: 'admin@enterprise.com',
      },
      {
        id: 'key-002',
        tenantId: 'tenant-enterprise',
        name: 'CI/CD Pipeline',
        prefix: 'atl_ci0d',
        scopes: ['read:workflows', 'write:deployments'],
        createdAt: isoNow(-60),
        lastUsedAt: isoNow(-2),
        expiresAt: null,
        active: true,
        createdBy: 'devops@enterprise.com',
      },
      {
        id: 'key-003',
        tenantId: 'tenant-enterprise',
        name: 'Legacy Integration (Deprecated)',
        prefix: 'atl_leg7',
        scopes: ['read:connectors'],
        createdAt: isoNow(-180),
        lastUsedAt: isoNow(-45),
        expiresAt: isoNow(-15),
        active: false,
        createdBy: 'admin@enterprise.com',
      },
      {
        id: 'key-004',
        tenantId: 'tenant-professional',
        name: 'Dev Environment',
        prefix: 'atl_dev8',
        scopes: ['read:workflows', 'read:connectors'],
        createdAt: isoNow(-30),
        lastUsedAt: isoNow(-5),
        expiresAt: isoNow(335),
        active: true,
        createdBy: 'developer@professional.com',
      },
    ];
    for (const k of keys) this.apiKeys.set(k.id, k);

    // ─── Onboarding ───────────────────────────────────────────────────────────
    const onboarding: OnboardingProgress[] = [
      {
        tenantId: 'tenant-enterprise',
        currentStep: 'producao',
        completedSteps: [
          'cadastro',
          'provisionamento',
          'conector',
          'primeiro_workflow',
          'primeira_execucao',
          'producao',
        ],
        startedAt: isoNow(-90),
        completedAt: isoNow(-60),
        percentComplete: 100,
      },
      {
        tenantId: 'tenant-professional',
        currentStep: 'primeira_execucao',
        completedSteps: ['cadastro', 'provisionamento', 'conector', 'primeiro_workflow'],
        startedAt: isoNow(-30),
        completedAt: null,
        percentComplete: pct(['cadastro', 'provisionamento', 'conector', 'primeiro_workflow']),
      },
      {
        tenantId: 'tenant-community',
        currentStep: 'conector',
        completedSteps: ['cadastro', 'provisionamento'],
        startedAt: isoNow(-7),
        completedAt: null,
        percentComplete: pct(['cadastro', 'provisionamento']),
      },
    ];
    for (const o of onboarding) this.onboarding.set(o.tenantId, o);

    // ─── Connectors ───────────────────────────────────────────────────────────
    const connectors: PortalConnector[] = [
      {
        id: 'pc-001',
        tenantId: 'tenant-enterprise',
        name: 'ERP Provider #1',
        type: 'erp-provider',
        version: '1.2.0',
        health: 'healthy',
        lastSyncAt: isoNow(-0.02),
        errorCount: 0,
        syncCount: 4820,
        installedAt: isoNow(-90),
      },
      {
        id: 'pc-002',
        tenantId: 'tenant-enterprise',
        name: 'PostgreSQL Production',
        type: 'database',
        version: '1.0.0',
        health: 'healthy',
        lastSyncAt: isoNow(-0.01),
        errorCount: 2,
        syncCount: 12000,
        installedAt: isoNow(-85),
      },
      {
        id: 'pc-003',
        tenantId: 'tenant-enterprise',
        name: 'REST API — External Partner',
        type: 'rest-api',
        version: '0.9.1',
        health: 'degraded',
        lastSyncAt: isoNow(-0.5),
        errorCount: 15,
        syncCount: 830,
        installedAt: isoNow(-45),
      },
      {
        id: 'pc-004',
        tenantId: 'tenant-professional',
        name: 'MySQL Analytics DB',
        type: 'database',
        version: '1.0.0',
        health: 'healthy',
        lastSyncAt: isoNow(-0.03),
        errorCount: 0,
        syncCount: 950,
        installedAt: isoNow(-28),
      },
    ];
    for (const c of connectors) this.connectors.set(c.id, c);

    // ─── Users ────────────────────────────────────────────────────────────────
    const users: PortalUser[] = [
      {
        id: 'usr-001',
        tenantId: 'tenant-enterprise',
        email: 'admin@enterprise.com',
        name: 'Enterprise Admin',
        role: 'owner',
        mfaEnabled: true,
        lastLoginAt: isoNow(-0.1),
        invitedAt: isoNow(-90),
        status: 'active',
      },
      {
        id: 'usr-002',
        tenantId: 'tenant-enterprise',
        email: 'devops@enterprise.com',
        name: 'DevOps Engineer',
        role: 'admin',
        mfaEnabled: true,
        lastLoginAt: isoNow(-1),
        invitedAt: isoNow(-88),
        status: 'active',
      },
      {
        id: 'usr-003',
        tenantId: 'tenant-enterprise',
        email: 'analyst@enterprise.com',
        name: 'Business Analyst',
        role: 'developer',
        mfaEnabled: false,
        lastLoginAt: isoNow(-3),
        invitedAt: isoNow(-60),
        status: 'active',
      },
      {
        id: 'usr-004',
        tenantId: 'tenant-enterprise',
        email: 'viewer@enterprise.com',
        name: 'Executive Viewer',
        role: 'viewer',
        mfaEnabled: false,
        lastLoginAt: null,
        invitedAt: isoNow(-2),
        status: 'invited',
      },
      {
        id: 'usr-005',
        tenantId: 'tenant-professional',
        email: 'developer@professional.com',
        name: 'Pro Developer',
        role: 'owner',
        mfaEnabled: false,
        lastLoginAt: isoNow(-0.5),
        invitedAt: isoNow(-30),
        status: 'active',
      },
    ];
    for (const u of users) this.users.set(u.id, u);
  }

  // ─── Support Tickets ───────────────────────────────────────────────────────
  listTickets(tenantId?: string, status?: SupportStatus): SupportTicket[] {
    const all = Array.from(this.tickets.values());
    return all.filter(
      (t) => (!tenantId || t.tenantId === tenantId) && (!status || t.status === status)
    );
  }

  getTicket(id: string): SupportTicket | undefined {
    return this.tickets.get(id);
  }

  createTicket(data: {
    tenantId: string;
    title: string;
    description: string;
    severity: SupportSeverity;
    category: SupportCategory;
  }): SupportTicket {
    const ticket: SupportTicket = {
      id: uid('tkt'),
      ...data,
      status: 'open',
      assignedTo: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resolvedAt: null,
      slaTargetHours: SLA_HOURS[data.severity],
    };
    this.tickets.set(ticket.id, ticket);
    return ticket;
  }

  updateTicketStatus(id: string, status: SupportStatus): SupportTicket | null {
    const ticket = this.tickets.get(id);
    if (!ticket) return null;
    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    if (status === 'resolved') ticket.resolvedAt = new Date().toISOString();
    return { ...ticket };
  }

  // ─── API Keys ──────────────────────────────────────────────────────────────
  listApiKeys(tenantId?: string): ApiKey[] {
    const all = Array.from(this.apiKeys.values());
    return tenantId ? all.filter((k) => k.tenantId === tenantId) : all;
  }

  getApiKey(id: string): ApiKey | undefined {
    return this.apiKeys.get(id);
  }

  createApiKey(data: {
    tenantId: string;
    name: string;
    scopes: string[];
    expiresAt?: string;
    createdBy: string;
  }): ApiKeyWithSecret {
    const rawKey = `atl_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
    const key: ApiKey = {
      id: uid('key'),
      tenantId: data.tenantId,
      name: data.name,
      prefix: rawKey.slice(0, 8),
      scopes: data.scopes,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      expiresAt: data.expiresAt ?? null,
      active: true,
      createdBy: data.createdBy,
    };
    this.apiKeys.set(key.id, key);
    return { ...key, key: rawKey };
  }

  revokeApiKey(id: string): boolean {
    const key = this.apiKeys.get(id);
    if (!key) return false;
    key.active = false;
    return true;
  }

  deleteApiKey(id: string): boolean {
    return this.apiKeys.delete(id);
  }

  // ─── Onboarding ───────────────────────────────────────────────────────────
  getOnboarding(tenantId: string): OnboardingProgress | undefined {
    return this.onboarding.get(tenantId);
  }

  completeStep(tenantId: string, step: OnboardingStep): OnboardingProgress | null {
    const progress = this.onboarding.get(tenantId);
    if (!progress) return null;
    if (!progress.completedSteps.includes(step)) {
      progress.completedSteps.push(step);
    }
    const idx = ONBOARDING_ORDER.indexOf(step);
    const nextIdx = idx + 1;
    if (nextIdx < ONBOARDING_ORDER.length) {
      progress.currentStep = ONBOARDING_ORDER[nextIdx]!;
    }
    progress.percentComplete = pct(progress.completedSteps);
    if (progress.percentComplete === 100 && !progress.completedAt) {
      progress.completedAt = new Date().toISOString();
    }
    return { ...progress };
  }

  // ─── Connectors ───────────────────────────────────────────────────────────
  listConnectors(tenantId?: string): PortalConnector[] {
    const all = Array.from(this.connectors.values());
    return tenantId ? all.filter((c) => c.tenantId === tenantId) : all;
  }

  updateConnectorHealth(id: string, health: ConnectorHealth): PortalConnector | null {
    const c = this.connectors.get(id);
    if (!c) return null;
    c.health = health;
    c.lastSyncAt = health !== 'error' ? new Date().toISOString() : c.lastSyncAt;
    return { ...c };
  }

  // ─── Users ────────────────────────────────────────────────────────────────
  listUsers(tenantId?: string): PortalUser[] {
    const all = Array.from(this.users.values());
    return tenantId ? all.filter((u) => u.tenantId === tenantId) : all;
  }

  getUser(id: string): PortalUser | undefined {
    return this.users.get(id);
  }

  inviteUser(data: { tenantId: string; email: string; name: string; role: UserRole }): PortalUser {
    const user: PortalUser = {
      id: uid('usr'),
      ...data,
      mfaEnabled: false,
      lastLoginAt: null,
      invitedAt: new Date().toISOString(),
      status: 'invited',
    };
    this.users.set(user.id, user);
    return user;
  }

  updateUserRole(id: string, role: UserRole): PortalUser | null {
    const user = this.users.get(id);
    if (!user) return null;
    user.role = role;
    return { ...user };
  }

  removeUser(id: string): boolean {
    return this.users.delete(id);
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────
  getDashboard(tenantId: string): PortalDashboard {
    const onboarding = this.onboarding.get(tenantId) ?? {
      tenantId,
      currentStep: 'cadastro' as OnboardingStep,
      completedSteps: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
      percentComplete: 0,
    };
    const connectors = this.listConnectors(tenantId);
    const openTickets =
      this.listTickets(tenantId, 'open').length + this.listTickets(tenantId, 'in_progress').length;

    const planMap: Record<string, string> = {
      'tenant-enterprise': 'enterprise',
      'tenant-professional': 'professional',
      'tenant-community': 'community',
    };

    const usageMap: Record<string, { used: number; total: number }> = {
      'tenant-enterprise': { used: 1840, total: 999999 },
      'tenant-professional': { used: 320, total: 1000 },
      'tenant-community': { used: 12, total: 100 },
    };

    const usage = usageMap[tenantId] ?? { used: 0, total: 100 };

    return {
      tenantId,
      plan: planMap[tenantId] ?? 'community',
      agentsOnline:
        tenantId === 'tenant-enterprise' ? 5 : tenantId === 'tenant-professional' ? 2 : 0,
      agentsTotal:
        tenantId === 'tenant-enterprise' ? 6 : tenantId === 'tenant-professional' ? 2 : 0,
      workflowsActive:
        tenantId === 'tenant-enterprise' ? 87 : tenantId === 'tenant-professional' ? 12 : 0,
      connectorsInstalled: connectors.length,
      apiCallsToday:
        tenantId === 'tenant-enterprise' ? 24800 : tenantId === 'tenant-professional' ? 3200 : 45,
      aiCreditsUsed: usage.used,
      aiCreditsTotal: usage.total,
      nextBillingDate: isoNow(15),
      openTickets,
      healthScore: connectors.some((c) => c.health === 'error')
        ? 60
        : connectors.some((c) => c.health === 'degraded')
          ? 80
          : 100,
      onboarding,
    };
  }
}

export const portalStore = new PortalStore();
