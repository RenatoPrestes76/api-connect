import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, loginAndGoToDashboard, loginViaUI, logoutViaUI } from './helpers';

test.describe('Login', () => {
  test('a página de login abre e os campos funcionam', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Atlas Control Plane' })).toBeVisible();
    const email = page.getByLabel('Email');
    const password = page.getByLabel('Senha');
    await email.fill('teste@example.com');
    await password.fill('qualquer-coisa');
    await expect(email).toHaveValue('teste@example.com');
    await expect(password).toHaveValue('qualquer-coisa');
  });

  test('login inválido é rejeitado com mensagem visível, sem quebrar a página', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Senha').fill('senha-errada-de-proposito');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('login válido estabelece sessão e leva ao dashboard', async ({ page }) => {
    await loginViaUI(page);
    await expect(page).toHaveURL(/\/(dashboard|change-password)/);
  });

  test('usuário deslogado não acessa /admin e é redirecionado ao login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('refresh da página mantém a sessão (cookie httpOnly sobrevive a reload)', async ({
    page,
  }) => {
    await loginAndGoToDashboard(page);
    await page.reload();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('logout funciona e o usuário deslogado não acessa mais rotas protegidas', async ({
    page,
  }) => {
    await loginAndGoToDashboard(page);
    await logoutViaUI(page);
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
