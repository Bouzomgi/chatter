import { test, expect } from '@playwright/test'

test('register new user redirects to / with empty sidebar', async ({ page }) => {
  const unique = Date.now()
  await page.goto('/register')
  await page.getByPlaceholder('email').fill(`newuser${unique}@example.com`)
  await page.getByPlaceholder('username').fill(`newuser${unique}`)
  await page.getByPlaceholder('password').fill('password123')
  await page.getByRole('button').click()
  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('sidebar')).toBeVisible()
  await expect(page.getByTestId('sidebar-toggle')).toHaveText('chat!')
})

test('login with wrong password shows error', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('email').fill('alice@example.com')
  await page.getByPlaceholder('password').fill('wrongpassword')
  await page.getByRole('button').click()
  await expect(page.getByText('Invalid credentials')).toBeVisible()
  await expect(page).toHaveURL('/login')
})

test('login with unknown email shows error', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('email').fill('nobody@example.com')
  await page.getByPlaceholder('password').fill('password123')
  await page.getByRole('button').click()
  await expect(page.getByText('Invalid credentials')).toBeVisible()
  await expect(page).toHaveURL('/login')
})
