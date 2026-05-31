import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import Sidebar from './Sidebar.js'
import type { Conversation, UserSummary } from '@chatter/shared'

vi.mock('../../lib/avatars.js', () => ({
  getAvatarSrc: (index: number) => `/avatars/${index}.png`,
}))

afterEach(cleanup)

const conversations: Conversation[] = [
  {
    id: 'c1',
    createdAt: '2026-01-01T00:00:00.000Z',
    participants: [{ id: 'u2', username: 'bob', avatarIndex: 1 }],
    latestMessage: { body: 'hey', senderId: 'u2', createdAt: '2026-01-01T00:00:00.000Z' },
    unread: false,
  },
  {
    id: 'c2',
    createdAt: '2026-01-01T00:00:00.000Z',
    participants: [{ id: 'u3', username: 'carol', avatarIndex: 2 }],
    latestMessage: null,
    unread: true,
  },
]

const users: UserSummary[] = [
  { id: 'u4', username: 'dave', avatarIndex: 4 },
  { id: 'u5', username: 'eve', avatarIndex: 5 },
]

const baseProps = {
  conversations,
  users,
  activeConversationId: null,
  showUserList: false,
  pendingUserIds: new Set<string>(),
  onlineUserIds: new Set<string>(),
  onSelectConversation: vi.fn(),
  onTogglePendingUser: vi.fn(),
  onToggleUserList: vi.fn(),
}

describe('Sidebar', () => {
  it('renders conversation list when showUserList is false', () => {
    render(<Sidebar {...baseProps} />)
    expect(screen.getAllByTestId('conversation-item')).toHaveLength(2)
    expect(screen.queryAllByTestId('user-item')).toHaveLength(0)
  })

  it('renders user list and header when showUserList is true', () => {
    render(<Sidebar {...baseProps} showUserList={true} />)
    expect(screen.getAllByTestId('user-item')).toHaveLength(2)
    expect(screen.queryAllByTestId('conversation-item')).toHaveLength(0)
    expect(screen.getByText('Start a New Chat')).toBeDefined()
  })

  it('toggle button shows "chat!" in conversation mode', () => {
    render(<Sidebar {...baseProps} />)
    expect(screen.getByTestId('sidebar-toggle').textContent).toBe('chat!')
  })

  it('toggle button shows "back" in user list mode', () => {
    render(<Sidebar {...baseProps} showUserList={true} />)
    expect(screen.getByTestId('sidebar-toggle').textContent).toBe('back')
  })

  it('calls onToggleUserList when toggle button is clicked', () => {
    const onToggleUserList = vi.fn()
    render(<Sidebar {...baseProps} onToggleUserList={onToggleUserList} />)
    fireEvent.click(screen.getByTestId('sidebar-toggle'))
    expect(onToggleUserList).toHaveBeenCalledOnce()
  })

  it('calls onSelectConversation with conversation id when item is clicked', () => {
    const onSelectConversation = vi.fn()
    render(<Sidebar {...baseProps} onSelectConversation={onSelectConversation} />)
    fireEvent.click(screen.getAllByTestId('conversation-item')[0])
    expect(onSelectConversation).toHaveBeenCalledWith('c1')
  })

  it('calls onTogglePendingUser with user when user item is clicked', () => {
    const onTogglePendingUser = vi.fn()
    render(<Sidebar {...baseProps} showUserList={true} onTogglePendingUser={onTogglePendingUser} />)
    fireEvent.click(screen.getAllByTestId('user-item')[0])
    expect(onTogglePendingUser).toHaveBeenCalledWith(users[0])
  })
})
