import { test, expect } from '@playwright/test'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@admin.local'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123'

async function loginAsAdmin(page: any) {
  await page.request.post('/auth/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
  await page.goto('/')
}

test('sidebar is visible after login', async ({ page }) => {
  await loginAsAdmin(page)
  await expect(page.getByTestId('sidebar')).toBeVisible()
})

test('chat! button switches to user list', async ({ page }) => {
  await loginAsAdmin(page)
  await page.getByTestId('sidebar-toggle').click()
  await expect(page.getByTestId('sidebar-toggle')).toHaveText('back')
})

test('back button returns to conversation list', async ({ page }) => {
  await loginAsAdmin(page)
  await page.getByTestId('sidebar-toggle').click()
  await page.getByTestId('sidebar-toggle').click()
  await expect(page.getByTestId('sidebar-toggle')).toHaveText('chat!')
})
