import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api } from './api.js'

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body }
}

function errorResponse(status: number) {
  return { ok: false, status, json: async () => ({ error: 'err' }) }
}

describe('api client', () => {
  it('returns the response on 2xx', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ id: '1' }))
    const res = await api.get('/test')
    expect(await res.json()).toEqual({ id: '1' })
  })

  it('throws on 500', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(500))
    await expect(api.get('/test')).rejects.toThrow('HTTP 500')
  })

  it('throws on 404', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(404))
    await expect(api.get('/test')).rejects.toThrow('HTTP 404')
  })

  it('throws on 403', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(403))
    await expect(api.get('/test')).rejects.toThrow('HTTP 403')
  })

  it('redirects to /login and throws on 401', async () => {
    const hrefSetter = vi.fn()
    Object.defineProperty(window.location, 'href', { set: hrefSetter, get: () => '', configurable: true })
    fetchMock.mockResolvedValueOnce(errorResponse(401))
    await expect(api.get('/test')).rejects.toThrow('Unauthorized')
    expect(hrefSetter).toHaveBeenCalledWith('/login')
  })

  it('throws on network failure', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(api.get('/test')).rejects.toThrow('Failed to fetch')
  })

  it('sends POST with JSON body', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({}))
    await api.post('/test', { key: 'value' })
    expect(fetchMock).toHaveBeenCalledWith('/test', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ key: 'value' }),
    }))
  })

  it('sends PATCH with no body', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({}))
    await api.patch('/test')
    expect(fetchMock).toHaveBeenCalledWith('/test', expect.objectContaining({ method: 'PATCH' }))
  })
})
