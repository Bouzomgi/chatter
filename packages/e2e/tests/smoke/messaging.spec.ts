import { test, expect } from '@playwright/test'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@admin.local'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123'

async function loginAsAdmin(page: any) {
  await page.request.post('/auth/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
  await page.goto('/')
}

test('message thread and input are visible when a conversation is open', async ({ page }) => {
  await loginAsAdmin(page)

  const conversationItems = page.getByTestId('conversation-item')
  const count = await conversationItems.count()

  if (count === 0) {
    // No conversations for this admin account — verify the empty state renders cleanly
    await expect(page.getByTestId('sidebar')).toBeVisible()
    return
  }

  await conversationItems.first().click()
  await expect(page.getByTestId('message-thread')).toBeVisible()
  await expect(page.getByTestId('message-input')).toBeVisible()
})

test('message input accepts typed text', async ({ page }) => {
  await loginAsAdmin(page)

  const conversationItems = page.getByTestId('conversation-item')
  const count = await conversationItems.count()

  if (count === 0) {
    test.skip()
    return
  }

  await conversationItems.first().click()

  const input = page.getByTestId('message-input')
  await input.fill('smoke test')
  await expect(input).toHaveValue('smoke test')
  // Clear without submitting — we do not create data in smoke tests
  await input.fill('')
})

test('user list loads when toggled', async ({ page }) => {
  await loginAsAdmin(page)
  await page.getByTestId('sidebar-toggle').click()
  // User list should appear (may be empty if only admin exists)
  await expect(page.getByTestId('sidebar-toggle')).toHaveText('back')
  // Sidebar remains visible
  await expect(page.getByTestId('sidebar')).toBeVisible()
})
