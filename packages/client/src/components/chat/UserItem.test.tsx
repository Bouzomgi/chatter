import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import UserItem from './UserItem.js'

vi.mock('../../lib/avatars.js', () => ({
  getAvatarSrc: (index: number) => `/avatars/${index}.png`,
}))

afterEach(cleanup)

const user = { id: 'u1', username: 'alice', avatarIndex: 3 }

describe('UserItem', () => {
  it('renders the username', () => {
    render(<UserItem user={user} selected={false} onClick={vi.fn()} />)
    expect(screen.getByText('alice')).toBeDefined()
  })

  it('renders avatar with correct src', () => {
    render(<UserItem user={user} selected={false} onClick={vi.fn()} />)
    const img = screen.getByAltText('alice') as HTMLImageElement
    expect(img.src).toContain('/avatars/3.png')
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<UserItem user={user} selected={false} onClick={onClick} />)
    fireEvent.click(screen.getByTestId('user-item'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
