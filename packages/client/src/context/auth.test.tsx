import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './auth.js'
import type { User } from '@chatter/shared'

// ── Consumer ─────────────────────────────────────────────────────────────────

const bob: User = { id: '2', username: 'bob', email: 'b@example.com', avatarIndex: 1, createdAt: '' }

function Consumer() {
  const { user, loading, setUser } = useAuth()
  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'done'}</span>
      <span data-testid="user">{user ? user.username : 'none'}</span>
      <button onClick={() => setUser(bob)}>set bob</button>
      <button onClick={() => setUser(null)}>clear user</button>
    </div>
  )
}

function renderAuth() {
  render(<AuthProvider><Consumer /></AuthProvider>)
}

// ── Setup ─────────────────────────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  cleanup()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AuthProvider', () => {
  it('starts in loading state with no user', () => {
    fetchMock.mockReturnValue(new Promise(() => {})) // never resolves
    renderAuth()
    expect(screen.getByTestId('loading').textContent).toBe('loading')
    expect(screen.getByTestId('user').textContent).toBe('none')
  })

  it('sets the user and finishes loading when /auth/me returns ok', async () => {
    const alice: User = { id: '1', username: 'alice', email: 'a@example.com', avatarIndex: 0, createdAt: '' }
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => alice })
    renderAuth()
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('done'))
    expect(screen.getByTestId('user').textContent).toBe('alice')
  })

  it('leaves user null and finishes loading when /auth/me returns non-ok', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })
    renderAuth()
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('done'))
    expect(screen.getByTestId('user').textContent).toBe('none')
  })

  it('leaves user null and finishes loading when fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network error'))
    renderAuth()
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('done'))
    expect(screen.getByTestId('user').textContent).toBe('none')
  })

  it('setUser updates the displayed user', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false })
    renderAuth()
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('done'))
    act(() => { screen.getByRole('button', { name: 'set bob' }).click() })
    expect(screen.getByTestId('user').textContent).toBe('bob')
  })

  it('setUser(null) clears the user', async () => {
    const alice: User = { id: '1', username: 'alice', email: 'a@example.com', avatarIndex: 0, createdAt: '' }
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => alice })
    renderAuth()
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('alice'))
    act(() => { screen.getByRole('button', { name: 'clear user' }).click() })
    expect(screen.getByTestId('user').textContent).toBe('none')
  })
})
