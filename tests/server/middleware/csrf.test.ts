import { describe, expect, it, vi } from 'vitest'
import { createMockEvent } from '~/tests/h3-helpers'
import adminGuard from '~/server/middleware/admin-guard'

async function getHandler() {
  vi.resetModules()
  const mod = await import('~/server/middleware/02.csrf')
  return mod.default
}

describe('csrf middleware', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('rejects cross-site %s requests to admin APIs', async (method) => {
    const handler = await getHandler()
    const event = createMockEvent({
      method,
      path: '/api/platform/photos',
      headers: {
        host: 'localhost:3000',
        origin: 'https://evil.example',
      },
    })

    expect(() => handler(event as any)).toThrow('Invalid request origin')
  })

  it('rejects mutating admin API requests without Origin or Referer', async () => {
    const handler = await getHandler()
    const event = createMockEvent({
      method: 'POST',
      path: '/api/platform/photos',
      headers: {
        host: 'localhost:3000',
      },
    })

    expect(() => handler(event as any)).toThrow('Invalid request origin')
  })

  it('allows same-origin mutating admin API requests', async () => {
    const handler = await getHandler()
    const event = createMockEvent({
      method: 'POST',
      path: '/api/platform/photos',
      headers: {
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
      },
    })

    expect(handler(event as any)).toBeUndefined()
  })

  it('uses Host before X-Forwarded-Host when validating browser origins', async () => {
    const handler = await getHandler()
    const event = createMockEvent({
      method: 'POST',
      path: '/api/platform/photos',
      headers: {
        host: 'localhost:3000',
        'x-forwarded-host': 'evil.example',
        origin: 'https://evil.example',
      },
    })

    expect(() => handler(event as any)).toThrow('Invalid request origin')
  })

  it('allows same-origin Referer when Origin is unavailable', async () => {
    const handler = await getHandler()
    const event = createMockEvent({
      method: 'DELETE',
      path: '/api/platform/photos',
      headers: {
        host: 'localhost:3000',
        referer: 'http://localhost:3000/platform/photos',
      },
    })

    expect(handler(event as any)).toBeUndefined()
  })

  it('passes same-origin admin API requests through to the existing admin guard', async () => {
    const handler = await getHandler()
    const event = createMockEvent({
      method: 'POST',
      path: '/api/platform/photos',
      headers: {
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
      },
    })

    expect(handler(event as any)).toBeUndefined()
    await expect(adminGuard(event as any)).rejects.toThrow('Authentication required')
  })

  it('skips public mutating APIs', async () => {
    const handler = await getHandler()
    const event = createMockEvent({
      method: 'POST',
      path: '/api/photos/example/reactions',
      headers: {
        host: 'localhost:3000',
        origin: 'https://evil.example',
      },
    })

    expect(handler(event as any)).toBeUndefined()
  })

  it('skips safe methods', async () => {
    const handler = await getHandler()
    const event = createMockEvent({
      method: 'GET',
      path: '/api/platform/photos',
      headers: {
        host: 'localhost:3000',
        origin: 'https://evil.example',
      },
    })

    expect(handler(event as any)).toBeUndefined()
  })
})
