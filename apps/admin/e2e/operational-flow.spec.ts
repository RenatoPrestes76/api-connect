import { test, expect } from '@playwright/test';
import { buildOperationalFixture, loginAndGoToDashboard } from './helpers';

test.describe('Fluxo operacional principal — Organization -> Runtime -> Discovery -> ERP Metadata -> Semantic Mapping -> Canonical Model', () => {
  test('cada etapa é visível e navegável pelo browser real, sobre uma fixture real', async ({
    page,
    request,
  }) => {
    const fixture = await buildOperationalFixture(request);

    await loginAndGoToDashboard(page);

    // ── Runtime ──────────────────────────────────────────────────────────
    // Several fixtures can accumulate across a long-running suite, so every
    // assertion below is scoped to the specific row for this fixture's
    // Runtime rather than matching anywhere on the page.
    await page.goto('/atlas-runtimes');
    const runtimeRow = page.locator('tr', { hasText: fixture.runtimeId.slice(0, 8) });
    await expect(runtimeRow).toBeVisible();
    await expect(runtimeRow.getByText(fixture.organizationId)).toBeVisible();
    await expect(runtimeRow.getByText('ACTIVE')).toBeVisible();
    await expect(runtimeRow.getByText('DATABASE_ACCESS')).toBeVisible();
    await expect(runtimeRow.getByText('POSTGRES')).toBeVisible();

    // ── Discovery ────────────────────────────────────────────────────────
    await page.goto('/discovery');
    const discoveryRow = page.locator('tr', { hasText: fixture.organizationId });
    await expect(discoveryRow).toBeVisible();
    await expect(discoveryRow.getByText('COMPLETED')).toBeVisible();

    // ── ERP Metadata ─────────────────────────────────────────────────────
    await page.goto('/erp-metadata');
    await page.getByPlaceholder('Profile ID da conexão ERP').fill(fixture.profileId);
    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(page.getByText('produtos')).toBeVisible();
    await expect(page.getByText('estoque')).toBeVisible();
    await expect(page.getByText('PRODUCT', { exact: true })).toBeVisible();

    // ── Semantic Mapping ─────────────────────────────────────────────────
    await page.goto('/semantic-mapping');
    await page.getByPlaceholder('Profile ID da conexão ERP').fill(fixture.profileId);
    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(page.getByText('produtos', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('APPROVED').first()).toBeVisible();

    // ── Canonical Model ──────────────────────────────────────────────────
    await page.goto('/canonical-model');
    await page.getByPlaceholder('Organization ID').fill(fixture.organizationId);
    await page.getByRole('button', { name: 'Buscar' }).click();
    // Product/Stock/Price canonical contracts must still be reachable.
    await expect(page.getByText('PRODUCT', { exact: true })).toBeVisible();
    await expect(page.getByText('INVENTORY', { exact: true })).toBeVisible();
  });

  test('aprovar um Semantic Mapping PENDING pelo próprio browser reflete no estado', async ({
    page,
    request,
  }) => {
    const fixture = await buildOperationalFixture(request, {
      autoApprove: false,
      autoBuildCanonical: false,
    });

    await loginAndGoToDashboard(page);
    await page.goto('/semantic-mapping');
    await page.getByPlaceholder('Profile ID da conexão ERP').fill(fixture.profileId);
    await page.getByRole('button', { name: 'Buscar' }).click();

    const produtosCard = page.locator('div.rounded-lg', { hasText: 'produtos' }).first();
    await expect(produtosCard.getByText('PENDING')).toBeVisible();

    await produtosCard.getByRole('button', { name: 'Aprovar' }).click();
    await expect(produtosCard.getByText('APPROVED')).toBeVisible();
    await expect(produtosCard.getByRole('button', { name: 'Aprovar' })).toHaveCount(0);
  });

  test('rejeitar um Semantic Mapping PENDING pelo browser reflete no estado', async ({
    page,
    request,
  }) => {
    const fixture = await buildOperationalFixture(request, {
      autoApprove: false,
      autoBuildCanonical: false,
    });

    await loginAndGoToDashboard(page);
    await page.goto('/semantic-mapping');
    await page.getByPlaceholder('Profile ID da conexão ERP').fill(fixture.profileId);
    await page.getByRole('button', { name: 'Buscar' }).click();

    const estoqueCard = page.locator('div.rounded-lg', { hasText: 'estoque' }).first();
    await expect(estoqueCard.getByText('PENDING')).toBeVisible();
    await estoqueCard.getByRole('button', { name: 'Rejeitar' }).click();
    await expect(estoqueCard.getByText('REJECTED')).toBeVisible();
  });
});

test.describe('Isolamento multi-tenant através do browser', () => {
  test('solicitar discovery com Runtime de uma organização e organizationId de outra é rejeitado na UI', async ({
    page,
    request,
  }) => {
    const orgA = await buildOperationalFixture(request, {
      autoApprove: false,
      autoBuildCanonical: false,
    });
    const orgB = await buildOperationalFixture(request, {
      autoApprove: false,
      autoBuildCanonical: false,
    });

    await loginAndGoToDashboard(page);
    await page.goto('/discovery');
    await page.getByRole('button', { name: 'Solicitar descoberta' }).click();
    await page.getByPlaceholder('Runtime ID').fill(orgA.runtimeId);
    await page.getByPlaceholder('Organization ID').fill(orgB.organizationId); // mismatched on purpose
    await page.getByPlaceholder('Profile ID (conexão ERP)').fill(orgA.profileId);
    await page.getByRole('button', { name: 'Solicitar', exact: true }).click();

    // The mismatch must be rejected by the real backend and surfaced to the
    // admin, not silently accepted and not a raw crash/stack trace.
    await expect(page.getByText('Algo deu errado')).toHaveCount(0);
    const errorToastOrDialogStillOpen = page.getByRole('dialog');
    // Either the dialog stays open (mutation failed) or a visible error state
    // renders — in both cases the request must NOT have silently succeeded.
    await expect(errorToastOrDialogStillOpen).toBeVisible();
  });
});
