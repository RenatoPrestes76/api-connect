import { test, expect } from '@playwright/test';
import { loginAndGoToDashboard } from './helpers';

// Every nav destination in apps/admin/src/lib/constants.ts (pre-existing +
// the 5 added in Sprint 46.15) — proves the whole Control Plane is reachable
// as ONE application, not several separate projects the admin has to hunt for.
const ALL_NAV_PATHS = [
  '/dashboard',
  '/fleet',
  '/tenants',
  '/companies',
  '/projects',
  '/environments',
  '/runtimes',
  '/atlas-runtimes',
  '/discovery',
  '/erp-metadata',
  '/semantic-mapping',
  '/canonical-model',
  '/marketplace',
  '/connector-registry',
  '/deployments',
  '/feature-flags',
  '/alerts',
  '/licenses',
  '/users',
  '/audit',
  '/monitoring',
  '/settings',
];

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
  });

  test('dashboard carrega e a navegação lateral aparece', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('ATLAS CONTROL PLANE v0.1')).toBeVisible();
    // A handful of nav labels — pre-existing and new — must all render together.
    for (const label of [
      'Dashboard',
      'Runtimes',
      'Atlas Runtimes',
      'Discovery',
      'Semantic Mapping',
    ]) {
      await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible();
    }
  });
});

test.describe('Navegação — nenhum link principal quebra', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
  });

  for (const path of ALL_NAV_PATHS) {
    test(`${path} carrega sem 404 e sem perder a sessão`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status(), `${path} deveria responder 200`).toBe(200);
      // A protected page that lost auth would bounce to /login.
      await expect(page).not.toHaveURL(/\/login/);
      // The sidebar (only rendered inside the authenticated (admin) layout)
      // must still be present — proves this wasn't silently a public 404 page.
      await expect(page.getByText('ATLAS CONTROL PLANE v0.1')).toBeVisible();
    });
  }
});

test.describe('Estados vazios e de erro não quebram a página', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
  });

  test('Atlas Runtimes sem nenhum Runtime mostra estado vazio, não erro', async ({ page }) => {
    await page.goto('/atlas-runtimes');
    // The Runtimes table always renders (with real rows or the empty-state
    // placeholder row) — its mere presence proves no crash. This page also
    // renders a second, unrelated Activation Keys table below it, so we
    // target the first table specifically.
    await expect(page.getByRole('table').first()).toBeVisible();
    await expect(page.getByText('Algo deu errado')).toHaveCount(0);
  });

  test('ERP Metadata sem Profile ID informado orienta o usuário, não quebra', async ({ page }) => {
    await page.goto('/erp-metadata');
    await expect(page.getByText('Informe um Profile ID para ver o catálogo.')).toBeVisible();
  });

  test('Canonical Model para organização inexistente mostra erro tratado, não stack trace', async ({
    page,
  }) => {
    await page.goto('/canonical-model');
    await page.getByPlaceholder('Organization ID').fill('org-que-nao-existe-e2e');
    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(page.getByText(/Nenhum modelo canônico construído/i)).toBeVisible();
    await expect(page.getByText(/at Object\.|\.tsx:|TypeError/i)).toHaveCount(0);
  });
});

test.describe('Responsividade', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
  });

  const VIEWPORTS: Array<{ name: string; width: number; height: number }> = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  for (const viewport of VIEWPORTS) {
    test(`Atlas Runtimes em ${viewport.name} não estoura horizontalmente`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/atlas-runtimes');
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(
        scrollWidth,
        `overflow horizontal em ${viewport.name}: scrollWidth=${scrollWidth} clientWidth=${clientWidth}`
      ).toBeLessThanOrEqual(clientWidth + 1);
    });
  }
});

test.describe('Segurança no browser', () => {
  test('nenhum token de sessão aparece em localStorage; cookie de sessão é httpOnly', async ({
    page,
    context,
  }) => {
    await loginAndGoToDashboard(page);
    const localStorageDump = await page.evaluate(() => JSON.stringify(localStorage));
    expect(localStorageDump).not.toContain(ADMIN_PASSWORD_MARKER);
    expect(localStorageDump.toLowerCase()).not.toMatch(/accesstoken|refreshtoken|"password"/);

    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name === 'admin_session');
    expect(session?.httpOnly, 'admin_session deve ser httpOnly').toBe(true);
    const refresh = cookies.find((c) => c.name === 'admin_refresh');
    expect(refresh?.httpOnly, 'admin_refresh deve ser httpOnly').toBe(true);
  });

  test('a licença/activation key não aparece em texto puro fora do fluxo de emissão', async ({
    page,
  }) => {
    await loginAndGoToDashboard(page);
    await page.goto('/atlas-runtimes');
    // The demo seed key is only ever shown right after issuance in its own
    // dialog — the table itself must never render a raw usable code as if
    // it were a secret dump.
    const bodyText = await page.textContent('body');
    expect(bodyText ?? '').not.toContain('S3nhaSuperSecreta');
  });
});

const ADMIN_PASSWORD_MARKER = 'root102030';
