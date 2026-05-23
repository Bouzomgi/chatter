import { test, expect } from '@playwright/test'

async function loginAs(page: any, email: string) {
  await page.request.post('/auth/login', { data: { email, password: 'password123' } })
  await page.goto('/')
}

test('alice sees 2 conversations', async ({ page }) => {
  await loginAs(page, 'alice@example.com')
  const items = page.getByTestId('conversation-item')
  await expect(items).toHaveCount(2)
})

test('carol conversation appears above bob (sorted by latest message)', async ({ page }) => {
  await loginAs(page, 'alice@example.com')
  const items = page.getByTestId('conversation-item')
  await expect(items.nth(0)).toContainText('carol')
  await expect(items.nth(1)).toContainText('bob')
})

test('alice-bob conversation loads 4 messages in order', async ({ page }) => {
  await loginAs(page, 'alice@example.com')
  await page.getByText('bob').first().click()
  const thread = page.getByTestId('message-thread')
  await expect(thread.getByText('Hey Bob!')).toBeVisible()
  await expect(thread.getByText('Hey Alice! How are you?')).toBeVisible()
  await expect(thread.getByText('Doing great, thanks for asking!')).toBeVisible()
  await expect(thread.getByText('Glad to hear it 😊')).toBeVisible()
})

test('alice-carol conversation loads 3 messages in order', async ({ page }) => {
  await loginAs(page, 'alice@example.com')
  await page.getByText('carol').first().click()
  const thread = page.getByTestId('message-thread')
  await expect(thread.getByText('Alice, are we still on for Thursday?')).toBeVisible()
  await expect(thread.getByText('Yes! See you then')).toBeVisible()
  await expect(thread.getByText('Perfect 👍')).toBeVisible()
})

test('sending a message appears in the thread', async ({ page }) => {
  await loginAs(page, 'alice@example.com')
  await page.getByText('bob').first().click()
  const msg = `send-test-${Date.now()}`
  await page.getByTestId('message-input').fill(msg)
  await page.getByTestId('message-input').press('Enter')
  await expect(page.getByTestId('message-thread').getByText(msg)).toBeVisible()
})
