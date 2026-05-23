import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@admin.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123';

test('unauthenticated user is redirected to /login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL('/login');
});

test('authenticated user visiting /login is redirected to /', async ({ page }) => {
  await page.request.post('/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  await page.goto('/login');
  await expect(page).toHaveURL('/');
});

test('login with valid credentials redirects to /', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('email').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('password').fill(ADMIN_PASSWORD);
  await page.getByRole('button').click();
  await expect(page).toHaveURL('/');
});

test('login with wrong password shows error', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('email').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('password').fill('wrongpassword');
  await page.getByRole('button').click();
  await expect(page.getByText('Invalid credentials')).toBeVisible();
  await expect(page).toHaveURL('/login');
});

test('register with duplicate email shows error', async ({ page }) => {
  await page.goto('/register');
  await page.getByPlaceholder('email').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('username').fill('newuser');
  await page.getByPlaceholder('password').fill('password123');
  await page.getByRole('button').click();
  await expect(page.getByText('Username or email already taken')).toBeVisible();
  await expect(page).toHaveURL('/register');
});

test('login page has link to register', async ({ page }) => {
  await page.goto('/login');
  await page.getByText('register?').click();
  await expect(page).toHaveURL('/register');
});

test('register page has link to login', async ({ page }) => {
  await page.goto('/register');
  await page.getByText('login?').click();
  await expect(page).toHaveURL('/login');
});
