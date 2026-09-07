import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import MessageInput from './MessageInput.js'

afterEach(cleanup)

describe('MessageInput', () => {
  it('renders the message input field', () => {
    render(<MessageInput onSend={vi.fn()} />)
    expect(screen.getByPlaceholderText('message')).toBeDefined()
  })

  it('calls onSend with trimmed text and clears input on Enter', () => {
    const onSend = vi.fn()
    render(<MessageInput onSend={onSend} />)
    const input = screen.getByPlaceholderText('message') as HTMLInputElement
    fireEvent.change(input, { target: { value: '  hello  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('hello')
    expect(input.value).toBe('')
  })

  it('does not call onSend when input is empty', () => {
    const onSend = vi.fn()
    render(<MessageInput onSend={onSend} />)
    const input = screen.getByPlaceholderText('message')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('does not call onSend when input is only whitespace', () => {
    const onSend = vi.fn()
    render(<MessageInput onSend={onSend} />)
    const input = screen.getByPlaceholderText('message')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('does not call onSend on non-Enter keys', () => {
    const onSend = vi.fn()
    render(<MessageInput onSend={onSend} />)
    const input = screen.getByPlaceholderText('message')
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'a' })
    expect(onSend).not.toHaveBeenCalled()
  })
})
