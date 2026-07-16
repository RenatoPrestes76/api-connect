import { describe, it, expect, beforeEach } from 'vitest';
import { FakeErpIntegrationRepository } from './fake-erp-integration-repository.js';
import {
  ErpIntegrationResolutionService,
  ErpIntegrationNotConfiguredError,
} from '../../modules/erp-integration/erp-integration-resolution.service.js';
import { ErpIntegrationHealthChecker } from '../../modules/erp-integration/erp-integration-health.js';
import { runWithTenantContext } from '../../infrastructure/data/tenant-context.js';

const ORG_OFF = 'org-off-company';
const ORG_ON = 'org-on-company';

describe('ErpIntegrationResolutionService', () => {
  let repo: FakeErpIntegrationRepository;
  let service: ErpIntegrationResolutionService;

  beforeEach(() => {
    repo = new FakeErpIntegrationRepository();
    service = new ErpIntegrationResolutionService(repo);
  });

  it('registers an OFF company correctly', async () => {
    await runWithTenantContext(ORG_OFF, () =>
      repo.upsertForCurrentTenant({ integrationType: 'OFF' })
    );
    const resolution = await service.resolve(ORG_OFF);
    expect(resolution.tipo_integracao).toBe('OFF');
    expect(resolution.organizationId).toBe(ORG_OFF);
  });

  it('registers an ON company correctly', async () => {
    await runWithTenantContext(ORG_ON, () =>
      repo.upsertForCurrentTenant({ integrationType: 'ON', erpName: 'SAP', host: 'erp.internal' })
    );
    const resolution = await service.resolve(ORG_ON);
    expect(resolution.tipo_integracao).toBe('ON');
  });

  it('resolves the correct configuration shape', async () => {
    await runWithTenantContext(ORG_ON, () =>
      repo.upsertForCurrentTenant({ integrationType: 'ON' })
    );
    const resolution = await service.resolve(ORG_ON);
    expect(resolution).toEqual({
      organizationId: ORG_ON,
      tipo_integracao: 'ON',
      permite_leitura: true,
      permite_escrita: false,
    });
  });

  it('permite_escrita is always false, regardless of mode or status', async () => {
    await runWithTenantContext(ORG_OFF, () =>
      repo.upsertForCurrentTenant({ integrationType: 'OFF', status: 'ACTIVE' })
    );
    const resolution = await service.resolve(ORG_OFF);
    expect(resolution.permite_escrita).toBe(false);
  });

  it('permite_leitura is false when the integration is INACTIVE', async () => {
    await runWithTenantContext(ORG_ON, () =>
      repo.upsertForCurrentTenant({ integrationType: 'ON', status: 'INACTIVE' })
    );
    const resolution = await service.resolve(ORG_ON);
    expect(resolution.permite_leitura).toBe(false);
  });

  it('does not mix configuration between different companies', async () => {
    await runWithTenantContext(ORG_OFF, () =>
      repo.upsertForCurrentTenant({ integrationType: 'OFF' })
    );
    await runWithTenantContext(ORG_ON, () =>
      repo.upsertForCurrentTenant({ integrationType: 'ON' })
    );

    const offResolution = await service.resolve(ORG_OFF);
    const onResolution = await service.resolve(ORG_ON);

    expect(offResolution.tipo_integracao).toBe('OFF');
    expect(onResolution.tipo_integracao).toBe('ON');
    expect(offResolution.organizationId).not.toBe(onResolution.organizationId);
  });

  it('throws ErpIntegrationNotConfiguredError for a company with no config', async () => {
    await expect(service.resolve('org-never-configured')).rejects.toThrow(
      ErpIntegrationNotConfiguredError
    );
  });

  it('rejects an empty organizationId rather than defaulting to any tenant', async () => {
    await expect(service.resolve('')).rejects.toThrow();
  });
});

describe('ErpIntegrationHealthChecker', () => {
  let repo: FakeErpIntegrationRepository;
  let checker: ErpIntegrationHealthChecker;

  beforeEach(() => {
    repo = new FakeErpIntegrationRepository();
    checker = new ErpIntegrationHealthChecker(repo);
  });

  it('returns PENDING replica checks for OFF mode (structure only)', async () => {
    await runWithTenantContext(ORG_OFF, () =>
      repo.upsertForCurrentTenant({ integrationType: 'OFF' })
    );
    const report = await checker.check(ORG_OFF);
    expect(report.tipo_integracao).toBe('OFF');
    expect(report.checks.map((c) => c.name)).toEqual([
      'replica_database_available',
      'last_synchronization',
    ]);
    expect(report.checks.every((c) => c.status === 'PENDING')).toBe(true);
  });

  it('returns PENDING connectivity checks for ON mode (structure only)', async () => {
    await runWithTenantContext(ORG_ON, () =>
      repo.upsertForCurrentTenant({ integrationType: 'ON' })
    );
    const report = await checker.check(ORG_ON);
    expect(report.checks.map((c) => c.name)).toEqual([
      'erp_connection_available',
      'latency',
      'connection_status',
    ]);
  });

  it('throws for an unconfigured company', async () => {
    await expect(checker.check('org-never-configured')).rejects.toThrow(
      ErpIntegrationNotConfiguredError
    );
  });
});
