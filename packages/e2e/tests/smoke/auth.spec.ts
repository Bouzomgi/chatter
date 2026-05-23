import { test, expect } from '@playwright/test'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@admin.local'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123'

test('unauthenticated visit to / redirects to /login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL('/login')
})

test('login as admin redirects to /', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('email').fill(ADMIN_EMAIL)
  await page.getByPlaceholder('password').fill(ADMIN_PASSWORD)
  await page.getByRole('button').click()
  await expect(page).toHaveURL('/')
})

test('header shows logo and log out button when authenticated', async ({ page }) => {
  await page.request.post('/auth/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('chatter')
  await expect(page.getByRole('button', { name: 'log out' })).toBeVisible()
})

test('log out redirects to /login', async ({ page }) => {
  await page.request.post('/auth/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
  await page.goto('/')
  await page.getByRole('button', { name: 'log out' }).click()
  await expect(page).toHaveURL('/login')
})

test('after logout / redirects to /login', async ({ page }) => {
  await page.request.post('/auth/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
  await page.goto('/')
  await page.getByRole('button', { name: 'log out' }).click()
  await page.goto('/')
  await expect(page).toHaveURL('/login')
})
