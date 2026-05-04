import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockEvent } from '~/tests/h3-helpers'

// Use dynamic import with resetModules to get fresh store each test
async function getHandler() {
  vi.resetModules()
  const mod = await import('~/server/middleware/01.rate-limit')
  return mod.default
}

describe('rate-limit middleware', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('skips non-API paths', async () => {
    const handler = await getHandler()
    const event = createMockEvent({ path: '/about' })
    const result = handler(event as any)
    expect(result).toBeUndefined()
  })

  it('sets X-RateLimit-Limit: 60 for public API', async () => {
    const handler = await getHandler()
    const event = createMockEvent({ path: '/api/photos' })
    handler(event as any)
    expect(event.__responseHeaders['X-RateLimit-Limit']).toBe('60')
  })

  it('sets X-RateLimit-Limit: 30 for admin API', async () => {
    const handler = await getHandler()
    const event = createMockEvent({ path: '/api/platform/photos' })
    handler(event as any)
    expect(event.__responseHeaders['X-RateLimit-Limit']).toBe('30')
  })

  it('sets X-RateLimit-Limit: 10 for OG API', async () => {
    const handler = await getHandler()
    const event = createMockEvent({ path: '/api/og/photos/slug' })
    handler(event as any)
    expect(event.__responseHeaders['X-RateLimit-Limit']).toBe('10')
  })

  it('decrements remaining count on each request', async () => {
    const handler = await getHandler()

    const event1 = createMockEvent({ path: '/api/photos' })
    handler(event1 as any)
    expect(event1.__responseHeaders['X-RateLimit-Remaining']).toBe('59')

    const event2 = createMockEvent({ path: '/api/photos' })
    handler(event2 as any)
    expect(event2.__responseHeaders['X-RateLimit-Remaining']).toBe('58')
  })

  it('throws 429 when exceeding OG limit', async () => {
    const handler = await getHandler()

    // Send 10 requests (at limit)
    for (let i = 0; i < 10; i++) {
      const event = createMockEvent({ path: '/api/og/site' })
      handler(event as any)
    }

    // 11th request should throw
    const event = createMockEvent({ path: '/api/og/site' })
    expect(() => handler(event as any)).toThrow('Too Many Requests')
  })

  it('includes Retry-After header when rate limited', async () => {
    const handler = await getHandler()

    for (let i = 0; i < 10; i++) {
      const event = createMockEvent({ path: '/api/og/site' })
      handler(event as any)
    }

    const event = createMockEvent({ path: '/api/og/site' })
    try {
      handler(event as any)
    } catch {
      // error expected
    }
    expect(event.__responseHeaders['Retry-After']).toBeDefined()
  })

  it('resets window after WINDOW_MS', async () => {
    const handler = await getHandler()

    // Exhaust OG limit
    for (let i = 0; i < 10; i++) {
      const event = createMockEvent({ path: '/api/og/site' })
      handler(event as any)
    }

    // Advance time past window (60 seconds)
    vi.advanceTimersByTime(61_000)

    // Should work again
    const event = createMockEvent({ path: '/api/og/site' })
    expect(() => handler(event as any)).not.toThrow()
    expect(event.__responseHeaders['X-RateLimit-Remaining']).toBe('9')
  })
})
