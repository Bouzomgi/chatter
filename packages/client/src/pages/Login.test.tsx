import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import Login from './Login.js'

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

function renderLogin() {
  return render(<Login />)
}

function fillForm(email: string, password: string) {
  fireEvent.change(screen.getByPlaceholderText('email'), { target: { id: 'email', value: email } })
  fireEvent.change(screen.getByPlaceholderText('password'), { target: { id: 'password', value: password } })
}

function clickSubmit() {
  fireEvent.click(screen.getByRole('button', { name: /submit/i }))
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Login', () => {
  it('renders email and password fields', () => {
    renderLogin()
    expect(screen.getByPlaceholderText('email')).toBeDefined()
    expect(screen.getByPlaceholderText('password')).toBeDefined()
  })

  it('shows error and does not fetch when fields are empty', async () => {
    renderLogin()
    await act(async () => { clickSubmit() })
    expect(screen.getByText('all fields required')).toBeDefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows error when only email is filled', async () => {
    renderLogin()
    fillForm('user@example.com', '')
    await act(async () => { clickSubmit() })
    expect(screen.getByText('all fields required')).toBeDefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('navigates to / and calls setUser on successful login', async () => {
    const fakeUser = { id: '1', username: 'alice', email: 'alice@example.com', avatarIndex: 0 }
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeUser,
    })
    renderLogin()
    fillForm('alice@example.com', 'password')
    await act(async () => { clickSubmit() })
    await waitFor(() => expect(mockSetUser).toHaveBeenCalledWith(fakeUser))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('shows server error message on failed login', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' }),
    })
    renderLogin()
    fillForm('alice@example.com', 'wrongpass')
    await act(async () => { clickSubmit() })
    await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeDefined())
    expect(mockSetUser).not.toHaveBeenCalled()
  })

  it('shows fallback error when server returns no error field', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    })
    renderLogin()
    fillForm('alice@example.com', 'wrongpass')
    await act(async () => { clickSubmit() })
    await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeDefined())
  })

  it('shows connection error when fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network failure'))
    renderLogin()
    fillForm('alice@example.com', 'password')
    await act(async () => { clickSubmit() })
    await waitFor(() => expect(screen.getByText('Could not connect to server')).toBeDefined())
  })
})
