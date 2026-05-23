import { test, expect } from '@playwright/test'

test('message sent by alice appears in carol\'s open conversation instantly', async ({ browser }) => {
  const ctxAlice = await browser.newContext()
  const ctxCarol = await browser.newContext()

  const alice = await ctxAlice.newPage()
  const carol = await ctxCarol.newPage()

  await alice.request.post('/auth/login', { data: { email: 'alice@example.com', password: 'password123' } })
  await carol.request.post('/auth/login', { data: { email: 'carol@example.com', password: 'password123' } })

  await alice.goto('/')
  await carol.goto('/')

  // Wait for sockets to connect before opening conversations
  await alice.waitForSelector('[data-socket-connected="true"]')
  await carol.waitForSelector('[data-socket-connected="true"]')

  // Both open the alice<->carol conversation
  await alice.getByText('carol').first().click()
  await alice.waitForSelector('[data-testid="message-input"]')
  await carol.getByText('alice').first().click()
  await carol.waitForSelector('[data-testid="message-input"]')

  // Alice sends a message
  const msg = `realtime-${Date.now()}`
  await alice.getByTestId('message-input').fill(msg)
  await alice.getByTestId('message-input').press('Enter')

  // Carol should see it without refreshing
  await expect(carol.getByTestId('message-thread').getByText(msg)).toBeVisible()

  await ctxAlice.close()
  await ctxCarol.close()
})
