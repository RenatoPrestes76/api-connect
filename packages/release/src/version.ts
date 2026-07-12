import type { ReleaseVersion, ReleaseStage } from './types.js';

const STAGE_ORDER: ReleaseStage[] = ['beta', 'rc1', 'rc2', 'rc3', 'ga'];

export function nextStage(current: ReleaseStage): ReleaseStage | null {
  const idx = STAGE_ORDER.indexOf(current);
  return idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1]! : null;
}

export function isGa(stage: ReleaseStage): boolean {
  return stage === 'ga';
}

export function stageLabel(stage: ReleaseStage): string {
  const labels: Record<ReleaseStage, string> = {
    beta: 'Beta Fechado',
    rc1: 'Release Candidate 1',
    rc2: 'Release Candidate 2',
    rc3: 'Release Candidate 3',
    ga: 'General Availability',
  };
  return labels[stage];
}

export class VersionManager {
  private versions: ReleaseVersion[] = [];

  constructor(initial?: ReleaseVersion[]) {
    if (initial) this.versions = [...initial];
  }

  seed(): void {
    const now = new Date();
    const t = (offset: number) => new Date(now.getTime() - offset * 86_400_000).toISOString();

    this.versions = [
      {
        version: '1.0.0-beta',
        stage: 'beta',
        buildNumber: 1,
        gitSha: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        releasedAt: t(21),
        certifiedAt: t(18),
        certifiedBy: 'renato@seltriva.com',
        notes: 'Beta fechado — 3 clientes piloto. Monitoramento intensivo.',
      },
      {
        version: '1.0.0-rc1',
        stage: 'rc1',
        buildNumber: 42,
        gitSha: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
        releasedAt: t(14),
        certifiedAt: t(12),
        certifiedBy: 'renato@seltriva.com',
        notes: 'Feature freeze. Regressão completa. P95 = 210ms.',
      },
      {
        version: '1.0.0-rc2',
        stage: 'rc2',
        buildNumber: 67,
        gitSha: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
        releasedAt: t(7),
        certifiedAt: t(5),
        certifiedBy: 'renato@seltriva.com',
        notes: 'Correções de segurança. MFA obrigatório ativado.',
      },
      {
        version: '1.0.0-rc3',
        stage: 'rc3',
        buildNumber: 89,
        gitSha: 'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
        releasedAt: t(3),
        certifiedAt: t(2),
        certifiedBy: 'renato@seltriva.com',
        notes: 'Go/No-Go aprovado. Todos os critérios de aceite atendidos.',
      },
      {
        version: '1.0.0',
        stage: 'ga',
        buildNumber: 100,
        gitSha: 'e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
        releasedAt: new Date().toISOString(),
        certifiedAt: new Date().toISOString(),
        certifiedBy: 'renato@seltriva.com',
        notes: '🚀 Atlas Connect v1.0 — General Availability. Plataforma liberada para clientes.',
      },
    ];
  }

  add(v: ReleaseVersion): void {
    this.versions.push(v);
  }

  list(): ReleaseVersion[] {
    return [...this.versions].sort((a, b) => b.buildNumber - a.buildNumber);
  }

  get(version: string): ReleaseVersion | undefined {
    return this.versions.find((v) => v.version === version);
  }

  latest(): ReleaseVersion | undefined {
    return this.list()[0];
  }

  current(): ReleaseVersion | undefined {
    return this.versions.find((v) => v.stage === 'ga') ?? this.latest();
  }

  certify(version: string, certifiedBy: string): ReleaseVersion | null {
    const v = this.versions.find((v) => v.version === version);
    if (!v) return null;
    v.certifiedAt = new Date().toISOString();
    v.certifiedBy = certifiedBy;
    return { ...v };
  }
}

export const versionManager = new VersionManager();
versionManager.seed();
