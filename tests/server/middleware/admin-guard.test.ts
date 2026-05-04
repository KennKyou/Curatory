import { describe, it, expect } from 'vitest'
import { createMockEvent } from '~/tests/h3-helpers'
import handler from '~/server/middleware/admin-guard'

describe('admin-guard middleware', () => {
  it('passes through public API routes and pages', async () => {
    await expect(handler(createMockEvent({ path: '/api/photos' }) as any)).resolves.toBeUndefined()
    await expect(handler(createMockEvent({ path: '/' }) as any)).resolves.toBeUndefined()
  })

  it('passes through login and registration pages', async () => {
    await expect(handler(createMockEvent({ path: '/platform/login' }) as any)).resolves.toBeUndefined()
    await expect(handler(createMockEvent({ path: '/platform/register' }) as any)).resolves.toBeUndefined()
  })

  it('throws 401 for protected API routes without session', async () => {
    await expect(handler(createMockEvent({ path: '/api/platform/photos' }) as any)).rejects.toThrow('Authentication required')
    await expect(handler(createMockEvent({ path: '/api/s3/scan' }) as any)).rejects.toThrow('Authentication required')
  })

  it('redirects protected platform pages without session', async () => {
    const result = await handler(createMockEvent({ path: '/platform/settings' }) as any)

    expect(result).toEqual({ __redirect: '/platform/login' })
  })

  it('allows protected platform routes when a session exists', async () => {
    const session = { user: { id: '507f1f77bcf86cd799439011', email: 'curator@test.com' } }

    await expect(handler(createMockEvent({ path: '/api/platform/photos', session }) as any)).resolves.toBeUndefined()
    await expect(handler(createMockEvent({ path: '/platform/settings', session }) as any)).resolves.toBeUndefined()
  })
})
