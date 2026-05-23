async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (res.status === 401) {
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  return res
}

export const api = {
  get: (path: string) =>
    apiFetch(path),

  post: <T>(path: string, body: T) =>
    apiFetch(path, { method: 'POST', body: JSON.stringify(body) }),

  put: <T>(path: string, body: T) =>
    apiFetch(path, { method: 'PUT', body: JSON.stringify(body) }),

  delete: (path: string) =>
    apiFetch(path, { method: 'DELETE' }),
}
