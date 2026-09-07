import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary.js'

afterEach(cleanup)

function Bomb(): never {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(<ErrorBoundary><span>ok</span></ErrorBoundary>)
    expect(screen.getByText('ok')).toBeDefined()
  })

  it('renders fallback UI when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Bomb /></ErrorBoundary>)
    expect(screen.getByText('something went wrong')).toBeDefined()
    expect(screen.getByRole('button', { name: 'go home' })).toBeDefined()
    spy.mockRestore()
  })

  it('navigates to / when "go home" is clicked', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const assignSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    })
    Object.defineProperty(window.location, 'href', { set: assignSpy, get: () => '', configurable: true })

    render(<ErrorBoundary><Bomb /></ErrorBoundary>)
    fireEvent.click(screen.getByRole('button', { name: 'go home' }))
    expect(assignSpy).toHaveBeenCalledWith('/')
    spy.mockRestore()
  })
})
