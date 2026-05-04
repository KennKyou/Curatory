interface MockEventOptions {
  method?: string
  query?: Record<string, string>
  body?: any
  params?: Record<string, string>
  session?: { user: { id: string, email: string } }
  headers?: Record<string, string>
  path?: string
}

export function createMockEvent(opts: MockEventOptions = {}) {
  return {
    method: opts.method || 'GET',
    __query: opts.query || {},
    __body: opts.body || {},
    __params: opts.params || {},
    __session: opts.session || null,
    __headers: opts.headers || {},
    __path: opts.path || '/',
    __responseHeaders: {} as Record<string, string>,
  }
}
