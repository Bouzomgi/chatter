import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import Register from './Register.js'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) =>
    <a href={to} {...props}>{children}</a>,
  useNavigate: () => mockNavigate,
}))

const mockSetUser = vi.fn()
vi.mock('../context/auth.js', () => ({
  useAuth: () => ({ setUser: mockSetUser }),
}))

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  mockNavigate.mockReset()
  mockSetUser.mockReset()
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderRegister() {
  return render(<Register />)
}

function fillForm(email: string, username: string, password: string) {
  fireEvent.change(screen.getByPlaceholderText('email'), { target: { id: 'email', value: email } })
  fireEvent.change(screen.getByPlaceholderText('username'), { target: { id: 'username', value: username } })
  fireEvent.change(screen.getByPlaceholderText('password'), { target: { id: 'password', value: password } })
}

function clickSubmit() {
  fireEvent.click(screen.getByRole('button', { name: /submit/i }))
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Register', () => {
  it('renders email, username, and password fields', () => {
    renderRegister()
    expect(screen.getByPlaceholderText('email')).toBeDefined()
    expect(screen.getByPlaceholderText('username')).toBeDefined()
    expect(screen.getByPlaceholderText('password')).toBeDefined()
  })

  it('shows error and does not fetch when all fields are empty', async () => {
    renderRegister()
    await act(async () => { clickSubmit() })
    expect(screen.getByText('all fields required')).toBeDefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows error when password is missing', async () => {
    renderRegister()
    fillForm('user@example.com', 'alice', '')
    await act(async () => { clickSubmit() })
    expect(screen.getByText('all fields required')).toBeDefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('navigates to / and calls setUser on successful registration', async () => {
    const fakeUser = { id: '1', username: 'alice', email: 'alice@example.com', avatarIndex: 0 }
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeUser,
    })
    renderRegister()
    fillForm('alice@example.com', 'alice', 'password123')
    await act(async () => { clickSubmit() })
    await waitFor(() => expect(mockSetUser).toHaveBeenCalledWith(fakeUser))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('shows server error on failed registration', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Email already taken' }),
    })
    renderRegister()
    fillForm('taken@example.com', 'alice', 'password123')
    await act(async () => { clickSubmit() })
    await waitFor(() => expect(screen.getByText('Email already taken')).toBeDefined())
    expect(mockSetUser).not.toHaveBeenCalled()
  })

  it('shows fallback error when server returns no error field', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    })
    renderRegister()
    fillForm('user@example.com', 'alice', 'password123')
    await act(async () => { clickSubmit() })
    await waitFor(() => expect(screen.getByText('Could not register')).toBeDefined())
  })

  it('shows connection error when fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network failure'))
    renderRegister()
    fillForm('user@example.com', 'alice', 'password123')
    await act(async () => { clickSubmit() })
    await waitFor(() => expect(screen.getByText('Could not connect to server')).toBeDefined())
  })
})
