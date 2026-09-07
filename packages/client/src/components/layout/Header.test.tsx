import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import Header from './Header.js'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()
let mockPathname = '/'

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname }),
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) =>
    <a href={to} {...props}>{children}</a>,
}))

const mockSetUser = vi.fn()
let mockUser: { id: string; username: string; email: string; avatarIndex: number; createdAt: string } | null = null

vi.mock('../../context/auth.js', () => ({
  useAuth: () => ({ user: mockUser, setUser: mockSetUser }),
}))

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', fetchMock)
  mockPathname = '/'
  mockUser = { id: 'u1', username: 'alice', email: 'alice@example.com', avatarIndex: 0, createdAt: '' }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  mockNavigate.mockReset()
  mockSetUser.mockReset()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Header', () => {
  it('renders the chatter title', () => {
    render(<Header />)
    expect(screen.getByText('chatter')).toBeDefined()
  })

  it('navigates to / when title is clicked', () => {
    render(<Header />)
    fireEvent.click(screen.getByText('chatter'))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('shows settings link and log out button when user is logged in', () => {
    render(<Header />)
    expect(screen.getByText('settings')).toBeDefined()
    expect(screen.getByRole('button', { name: 'log out' })).toBeDefined()
  })

  it('hides settings and log out when no user', () => {
    mockUser = null
    render(<Header />)
    expect(screen.queryByText('settings')).toBeNull()
    expect(screen.queryByRole('button', { name: 'log out' })).toBeNull()
  })

  it('calls logout, clears user, and navigates to /login on log out click', async () => {
    render(<Header />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'log out' }))
    })
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/auth/logout', expect.objectContaining({ method: 'POST' }))
      expect(mockSetUser).toHaveBeenCalledWith(null)
      expect(mockNavigate).toHaveBeenCalledWith('/login')
    })
  })

  it('settings link is white when on /settings', () => {
    mockPathname = '/settings'
    render(<Header />)
    const link = screen.getByText('settings') as HTMLElement
    expect(link.style.color).toBe('white')
  })

  it('settings link has no color override when not on /settings', () => {
    mockPathname = '/'
    render(<Header />)
    const link = screen.getByText('settings') as HTMLElement
    expect(link.style.color).toBe('')
  })
})
