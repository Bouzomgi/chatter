import { test, expect } from '@playwright/test'

test('online indicator appears when conversation partner connects and disappears when they disconnect', async ({ browser }) => {
  const ctxAlice = await browser.newContext()
  const ctxBob = await browser.newContext()

  const alice = await ctxAlice.newPage()
  const bob = await ctxBob.newPage()

  await alice.request.post('/auth/login', { data: { email: 'alice@example.com', password: 'password123' } })
  await bob.request.post('/auth/login', { data: { email: 'bob@example.com', password: 'password123' } })

  // Alice connects first
  await alice.goto('/')
  await alice.waitForSelector('[data-socket-connected="true"]')

  // Bob connects — alice should receive user:online
  await bob.goto('/')
  await bob.waitForSelector('[data-socket-connected="true"]')

  // Alice opens the alice<->bob conversation
  await alice.getByText('bob').first().click()

  // Green dot on bob's avatar in sidebar
  await expect(alice.locator('[aria-label="Online"]').first()).toBeVisible()

  // "Online" label in the chat header
  await expect(alice.getByText('Online', { exact: true })).toBeVisible()

  // Bob disconnects
  await ctxBob.close()

  // Green dot and label should disappear
  await expect(alice.locator('[aria-label="Online"]').first()).not.toBeVisible()
  await expect(alice.getByText('Online', { exact: true })).not.toBeVisible()

  await ctxAlice.close()
})
