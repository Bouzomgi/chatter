import { API_BASE_URL, WS_BASE_URL } from './config.js'

// `any`, not `unknown` — callers each know their own event's payload shape
// (message:new gets a Message, presence events get their own shape, etc.),
// the same way socket.io-client's own listener types work. A shared union of
// every event's payload would be more precise but isn't worth it for the
// handful of events this app has.
type Listener = (payload: any) => void

const MAX_RECONNECT_DELAY_MS = 15000

// Stands in for socket.io-client against a plain API Gateway WebSocket API.
// Exposes the same on/off/connect/disconnect surface the rest of the app
// already uses, so socket.tsx and useChat.ts barely change — everything
// socket.io did automatically (auth handshake, reconnect with backoff) is
// implemented by hand here instead.
class ManagedSocket {
  private ws: WebSocket | null = null
  private listeners: Record<string, Listener[]> = {}
  private manualDisconnect = false
  private hasConnectedOnce = false
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  on(event: string, handler: Listener): void {
    ;(this.listeners[event] ??= []).push(handler)
  }

  off(event: string, handler: Listener): void {
    this.listeners[event] = (this.listeners[event] ?? []).filter((h) => h !== handler)
  }

  private emit(event: string, payload?: unknown): void {
    this.listeners[event]?.forEach((h) => h(payload))
  }

  connect(): void {
    this.manualDisconnect = false
    void this.open()
  }

  disconnect(): void {
    this.manualDisconnect = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }

  sendMessage(conversationId: string, body: string): void {
    this.ws?.send(JSON.stringify({ action: 'sendMessage', conversationId, body }))
  }

  // The WebSocket handshake can't carry the httpOnly session cookie the way
  // a normal fetch does — this exchanges it for a short-lived ticket first
  // (see GET /auth/ws-ticket), then opens the socket with that as a query
  // param, since browsers also can't set custom headers on a WS handshake.
  private async open(): Promise<void> {
    let token: string
    try {
      const res = await fetch(`${API_BASE_URL}/auth/ws-ticket`, { credentials: 'include' })
      if (!res.ok) throw new Error(`ws-ticket request failed: ${res.status}`)
      ;({ token } = (await res.json()) as { token: string })
    } catch {
      this.scheduleReconnect()
      return
    }

    const ws = new WebSocket(`${WS_BASE_URL}?token=${encodeURIComponent(token)}`)
    this.ws = ws

    ws.onopen = () => {
      this.reconnectAttempt = 0
      this.emit('connect')
      if (this.hasConnectedOnce) this.emit('reconnect')
      this.hasConnectedOnce = true
    }

    ws.onclose = () => {
      this.emit('disconnect')
      if (!this.manualDisconnect) this.scheduleReconnect()
    }

    ws.onerror = () => {
      ws.close()
    }

    ws.onmessage = (event: MessageEvent<string>) => {
      let parsed: { type?: string; message?: unknown }
      try {
        parsed = JSON.parse(event.data)
      } catch {
        return
      }
      if (parsed.type) this.emit(parsed.type, parsed.message)
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempt += 1
    const delay = Math.min(1000 * 2 ** (this.reconnectAttempt - 1), MAX_RECONNECT_DELAY_MS)
    this.reconnectTimer = setTimeout(() => {
      if (!this.manualDisconnect) void this.open()
    }, delay)
  }
}

export const socket = new ManagedSocket()
