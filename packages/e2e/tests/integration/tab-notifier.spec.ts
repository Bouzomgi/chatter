import { test, expect, type Page } from '@playwright/test'

async function loginAs(page: Page, email: string, password: string) {
  await page.request.post('/auth/login', { data: { email, password } })
  await page.goto('/')
  await page.waitForSelector('[data-socket-connected="true"]')
}

test.describe('tab title notifier', () => {
  test('title changes to chatter!!! when message arrives in a non-active conversation', async ({ browser }) => {
    const ctxAlice = await browser.newContext()
    const ctxCarol = await browser.newContext()
    const alice = await ctxAlice.newPage()
    const carol = await ctxCarol.newPage()

    await loginAs(alice, 'alice@example.com', 'password123')
    await loginAs(carol, 'carol@example.com', 'password123')

    // Alice opens the alice<->bob conversation (not carol's)
    await alice.getByText('bob').first().click()
    await alice.waitForSelector('[data-testid="message-input"]')

    // Carol opens her conversation with alice and sends a message
    await carol.getByText('alice').first().click()
    await carol.waitForSelector('[data-testid="message-input"]')
    await carol.getByTestId('message-input').fill(`tab-test-${Date.now()}`)
    await carol.getByTestId('message-input').press('Enter')

    // Alice's tab title should flip to chatter!!!
    await expect.poll(() => alice.title()).toBe('chatter!!!')

    await ctxAlice.close()
    await ctxCarol.close()
  })

  test('title stays chatter when message arrives in the active conversation', async ({ browser }) => {
    const ctxAlice = await browser.newContext()
    const ctxCarol = await browser.newContext()
    const alice = await ctxAlice.newPage()
    const carol = await ctxCarol.newPage()

    await loginAs(alice, 'alice@example.com', 'password123')
    await loginAs(carol, 'carol@example.com', 'password123')

    // Alice opens the alice<->carol conversation
    await alice.getByText('carol').first().click()
    await alice.waitForSelector('[data-testid="message-input"]')

    // Carol sends a message into that same conversation
    await carol.getByText('alice').first().click()
    await carol.waitForSelector('[data-testid="message-input"]')
    await carol.getByTestId('message-input').fill(`tab-active-${Date.now()}`)
    await carol.getByTestId('message-input').press('Enter')

    // Wait for the message to arrive, then assert title is still chatter
    await expect(alice.getByTestId('message-thread').getByText(/tab-active-/)).toBeVisible()
    expect(await alice.title()).toBe('chatter')

    await ctxAlice.close()
    await ctxCarol.close()
  })

  test('title resets to chatter when user opens the conversation', async ({ browser }) => {
    const ctxAlice = await browser.newContext()
    const ctxCarol = await browser.newContext()
    const alice = await ctxAlice.newPage()
    const carol = await ctxCarol.newPage()

    await loginAs(alice, 'alice@example.com', 'password123')
    await loginAs(carol, 'carol@example.com', 'password123')

    // Alice starts on bob's conversation
    await alice.getByText('bob').first().click()
    await alice.waitForSelector('[data-testid="message-input"]')

    // Carol sends alice a message
    await carol.getByText('alice').first().click()
    await carol.waitForSelector('[data-testid="message-input"]')
    await carol.getByTestId('message-input').fill(`tab-reset-${Date.now()}`)
    await carol.getByTestId('message-input').press('Enter')

    await expect.poll(() => alice.title()).toBe('chatter!!!')

    // Alice clicks carol's conversation
    await alice.getByText('carol').first().click()
    await expect.poll(() => alice.title()).toBe('chatter')

    await ctxAlice.close()
    await ctxCarol.close()
  })

  test('title changes to chatter!!! when message arrives while on the settings page', async ({ browser }) => {
    const ctxAlice = await browser.newContext()
    const ctxCarol = await browser.newContext()
    const alice = await ctxAlice.newPage()
    const carol = await ctxCarol.newPage()

    await loginAs(alice, 'alice@example.com', 'password123')
    await loginAs(carol, 'carol@example.com', 'password123')

    // Alice navigates to settings
    await alice.getByRole('link', { name: 'settings' }).click()
    await alice.waitForURL('/settings')

    // Carol sends alice a message
    await carol.getByText('alice').first().click()
    await carol.waitForSelector('[data-testid="message-input"]')
    await carol.getByTestId('message-input').fill(`tab-settings-${Date.now()}`)
    await carol.getByTestId('message-input').press('Enter')

    // Alice's tab should still show chatter!!! even on the settings page
    await expect.poll(() => alice.title()).toBe('chatter!!!')

    await ctxAlice.close()
    await ctxCarol.close()
  })
})
