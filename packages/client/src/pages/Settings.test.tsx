import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import Settings from './Settings.js'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

const mockSetUser = vi.fn()
const mockUser = { id: '1', username: 'alice', email: 'alice@example.com', avatarIndex: 2, createdAt: '' }
vi.mock('../context/auth.js', () => ({
  useAuth: () => ({ user: mockUser, setUser: mockSetUser }),
}))

const { mockApi } = vi.hoisted(() => ({ mockApi: { put: vi.fn() } }))
vi.mock('../lib/api.js', () => ({ api: mockApi }))

vi.mock('../lib/avatars.js', () => ({
  getAvatarSrc: (index: number) => `/avatars/${index}.png`,
}))

vi.mock('../components/modal/AvatarSelectionModal.js', () => ({
  default: ({ onSelect, onClose }: { onSelect: (i: number) => void; onClose: () => void }) => (
    <div data-testid="avatar-modal">
      <button onClick={() => onSelect(5)}>pick avatar 5</button>
      <button onClick={onClose}>close</button>
    </div>
  ),
}))

afterEach(() => {
  cleanup()
  mockNavigate.mockReset()
  mockSetUser.mockReset()
  mockApi.put.mockReset()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Settings', () => {
  it('renders the current avatar from the user context', () => {
    render(<Settings />)
    const img = screen.getByTestId('current-avatar') as HTMLImageElement
    expect(img.src).toContain('/avatars/2.png')
  })

  it('opens the avatar modal when the avatar is clicked', async () => {
    render(<Settings />)
    expect(screen.queryByTestId('avatar-modal')).toBeNull()
    fireEvent.click(screen.getByTestId('current-avatar'))
    expect(screen.getByTestId('avatar-modal')).toBeDefined()
  })

  it('closes the modal when onClose is called', async () => {
    render(<Settings />)
    fireEvent.click(screen.getByTestId('current-avatar'))
    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    expect(screen.queryByTestId('avatar-modal')).toBeNull()
  })

  it('updates selected avatar when a new one is picked from the modal', async () => {
    render(<Settings />)
    fireEvent.click(screen.getByTestId('current-avatar'))
    fireEvent.click(screen.getByRole('button', { name: 'pick avatar 5' }))
    const img = screen.getByTestId('current-avatar') as HTMLImageElement
    expect(img.src).toContain('/avatars/5.png')
    expect(screen.queryByTestId('avatar-modal')).toBeNull()
  })

  it('calls PUT /users/me and navigates to / on save', async () => {
    const updatedUser = { ...mockUser, avatarIndex: 2 }
    mockApi.put.mockResolvedValueOnce({ ok: true, json: async () => updatedUser })
    render(<Settings />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    })
    await waitFor(() => expect(mockSetUser).toHaveBeenCalledWith(updatedUser))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('does not navigate when PUT fails', async () => {
    mockApi.put.mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    render(<Settings />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    })
    await waitFor(() => expect(mockApi.put).toHaveBeenCalled())
    expect(mockSetUser).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('does not navigate when PUT throws', async () => {
    mockApi.put.mockRejectedValueOnce(new Error('network'))
    render(<Settings />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    })
    await waitFor(() => expect(mockApi.put).toHaveBeenCalled())
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
