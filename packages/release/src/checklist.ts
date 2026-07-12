import type {
  ChecklistItem,
  ChecklistCategory,
  ChecklistStatus,
  ChecklistResult,
  ChecklistSummary,
} from './types.js';

const SLA_MAP: Record<ChecklistCategory, number> = {
  produto: 0,
  infra: 0,
  seguranca: 0,
  performance: 0,
  suporte: 0,
  comercial: 0,
};

const GA_CHECKLIST_DEFINITIONS: Omit<
  ChecklistItem,
  'status' | 'checkedAt' | 'checkedBy' | 'notes'
>[] = [
  // Produto
  {
    id: 'prod-001',
    category: 'produto',
    label: 'APIs REST documentadas e versionadas (v1)',
    blocksRelease: true,
  },
  {
    id: 'prod-002',
    category: 'produto',
    label: 'Dashboard administrativo 100% operacional',
    blocksRelease: true,
  },
  {
    id: 'prod-003',
    category: 'produto',
    label: 'Billing & Licensing com Stripe em produção',
    blocksRelease: true,
  },
  {
    id: 'prod-004',
    category: 'produto',
    label: 'Marketplace de conectores publicado',
    blocksRelease: true,
  },
  {
    id: 'prod-005',
    category: 'produto',
    label: 'AI Copilot com Claude Opus 4.8 ativo',
    blocksRelease: false,
  },
  {
    id: 'prod-006',
    category: 'produto',
    label: 'Workflow Builder IA validado em produção',
    blocksRelease: true,
  },
  {
    id: 'prod-007',
    category: 'produto',
    label: 'Atlas Agents (Edge) com provisionamento automático',
    blocksRelease: true,
  },
  {
    id: 'prod-008',
    category: 'produto',
    label: 'Multi-tenancy validado (enterprise/professional/community)',
    blocksRelease: true,
  },
  {
    id: 'prod-009',
    category: 'produto',
    label: 'Portal do cliente self-service operacional',
    blocksRelease: false,
  },
  // Infra
  {
    id: 'infra-001',
    category: 'infra',
    label: 'Cluster Kubernetes com rolling update configurado',
    blocksRelease: true,
  },
  {
    id: 'infra-002',
    category: 'infra',
    label: 'HPA configurado (2–10 réplicas API, 1–6 worker)',
    blocksRelease: true,
  },
  {
    id: 'infra-003',
    category: 'infra',
    label: 'Backups automáticos diários validados',
    blocksRelease: true,
  },
  {
    id: 'infra-004',
    category: 'infra',
    label: 'Disaster Recovery testado (RTO ≤ 15min, RPO ≤ 5min)',
    blocksRelease: true,
  },
  {
    id: 'infra-005',
    category: 'infra',
    label: 'Helm Chart publicado com values.yaml completo',
    blocksRelease: false,
  },
  {
    id: 'infra-006',
    category: 'infra',
    label: 'Docker Compose oficial disponível',
    blocksRelease: false,
  },
  {
    id: 'infra-007',
    category: 'infra',
    label: 'Monitoramento e alertas ativos (Prometheus/Grafana)',
    blocksRelease: true,
  },
  {
    id: 'infra-008',
    category: 'infra',
    label: 'Status page publicada e configurada',
    blocksRelease: false,
  },
  // Segurança
  {
    id: 'sec-001',
    category: 'seguranca',
    label: 'Pentest final executado sem críticos',
    blocksRelease: true,
  },
  {
    id: 'sec-002',
    category: 'seguranca',
    label: 'OWASP Top 10 — 0 vulnerabilidades abertas',
    blocksRelease: true,
  },
  {
    id: 'sec-003',
    category: 'seguranca',
    label: 'Secrets scan — nenhum segredo exposto',
    blocksRelease: true,
  },
  {
    id: 'sec-004',
    category: 'seguranca',
    label: 'Dependency scan — sem CVE crítico',
    blocksRelease: true,
  },
  {
    id: 'sec-005',
    category: 'seguranca',
    label: 'MFA obrigatório para administradores',
    blocksRelease: true,
  },
  {
    id: 'sec-006',
    category: 'seguranca',
    label: 'SSO validado (OIDC + SAML)',
    blocksRelease: false,
  },
  {
    id: 'sec-007',
    category: 'seguranca',
    label: 'Artefatos de release assinados (Ed25519)',
    blocksRelease: false,
  },
  { id: 'sec-008', category: 'seguranca', label: 'SBOM gerado e publicado', blocksRelease: false },
  // Performance
  {
    id: 'perf-001',
    category: 'performance',
    label: 'Load Test aprovado — P95 < 300ms a 100 VUs',
    blocksRelease: true,
  },
  {
    id: 'perf-002',
    category: 'performance',
    label: 'Stress Test — sistema estável a 400 VUs',
    blocksRelease: false,
  },
  {
    id: 'perf-003',
    category: 'performance',
    label: 'Endurance Test 2h — sem memory leak detectado',
    blocksRelease: false,
  },
  {
    id: 'perf-004',
    category: 'performance',
    label: 'Disponibilidade 99,9% — SLA alvo validado',
    blocksRelease: true,
  },
  {
    id: 'perf-005',
    category: 'performance',
    label: 'Cobertura de testes ≥ 85%',
    blocksRelease: false,
  },
  // Suporte
  {
    id: 'sup-001',
    category: 'suporte',
    label: 'Runbooks operacionais aprovados (P1–P4)',
    blocksRelease: true,
  },
  {
    id: 'sup-002',
    category: 'suporte',
    label: 'Matriz de escalação definida e comunicada',
    blocksRelease: true,
  },
  {
    id: 'sup-003',
    category: 'suporte',
    label: 'On-call schedule configurado (24x7 P1/P2)',
    blocksRelease: true,
  },
  {
    id: 'sup-004',
    category: 'suporte',
    label: 'Documentação técnica publicada',
    blocksRelease: false,
  },
  {
    id: 'sup-005',
    category: 'suporte',
    label: 'Processo de onboarding validado end-to-end',
    blocksRelease: false,
  },
  // Comercial
  {
    id: 'com-001',
    category: 'comercial',
    label: 'Pricing definido (Community/Professional/Enterprise)',
    blocksRelease: true,
  },
  {
    id: 'com-002',
    category: 'comercial',
    label: 'Material comercial (pitch deck, one-pager) pronto',
    blocksRelease: false,
  },
  {
    id: 'com-003',
    category: 'comercial',
    label: 'Catálogo de conectores publicado',
    blocksRelease: false,
  },
  {
    id: 'com-004',
    category: 'comercial',
    label: 'Feature flags configuradas para GA',
    blocksRelease: false,
  },
  {
    id: 'com-005',
    category: 'comercial',
    label: 'Go-Live autorizado pelo responsável técnico',
    blocksRelease: true,
  },
];

export class ReleaseChecklistRunner {
  private items: Map<string, ChecklistItem> = new Map();

  constructor() {
    for (const def of GA_CHECKLIST_DEFINITIONS) {
      this.items.set(def.id, {
        ...def,
        status: 'pending',
        notes: null,
        checkedAt: null,
        checkedBy: null,
      });
    }
  }

  mark(
    id: string,
    status: ChecklistStatus,
    opts: { notes?: string; checkedBy?: string } = {}
  ): ChecklistItem | null {
    const item = this.items.get(id);
    if (!item) return null;
    item.status = status;
    item.notes = opts.notes ?? item.notes;
    item.checkedBy = opts.checkedBy ?? item.checkedBy;
    item.checkedAt = status !== 'pending' ? new Date().toISOString() : null;
    return { ...item };
  }

  markAll(status: ChecklistStatus, checkedBy = 'system'): void {
    for (const item of this.items.values()) {
      item.status = status;
      item.checkedBy = checkedBy;
      item.checkedAt = new Date().toISOString();
    }
  }

  get(id: string): ChecklistItem | undefined {
    const item = this.items.get(id);
    return item ? { ...item } : undefined;
  }

  list(): ChecklistItem[] {
    return Array.from(this.items.values()).map((i) => ({ ...i }));
  }

  summarize(): ChecklistSummary {
    const items = this.list();
    const byCategory = {} as Record<ChecklistCategory, { total: number; passed: number }>;
    const categories: ChecklistCategory[] = [
      'produto',
      'infra',
      'comercial',
      'suporte',
      'seguranca',
      'performance',
    ];
    for (const cat of categories) {
      byCategory[cat] = { total: 0, passed: 0 };
    }

    let passed = 0,
      failed = 0,
      pending = 0,
      skipped = 0,
      blockers = 0;
    for (const item of items) {
      byCategory[item.category].total++;
      if (item.status === 'passed') {
        passed++;
        byCategory[item.category].passed++;
      } else if (item.status === 'failed') {
        failed++;
        if (item.blocksRelease) blockers++;
      } else if (item.status === 'pending' || item.status === 'running') pending++;
      else if (item.status === 'skipped') {
        skipped++;
        byCategory[item.category].passed++;
      }
    }

    return {
      total: items.length,
      passed,
      failed,
      pending,
      skipped,
      blockers,
      readyForRelease: blockers === 0 && failed === 0 && pending === 0,
      byCategory,
    };
  }

  getResult(): ChecklistResult {
    return { ...this.summarize(), items: this.list() };
  }

  reset(): void {
    for (const item of this.items.values()) {
      item.status = 'pending';
      item.notes = null;
      item.checkedAt = null;
      item.checkedBy = null;
    }
  }
}

export const CHECKLIST_TOTAL = GA_CHECKLIST_DEFINITIONS.length;
export const BLOCKER_COUNT = GA_CHECKLIST_DEFINITIONS.filter((d) => d.blocksRelease).length;
