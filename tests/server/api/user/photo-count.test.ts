import { describe, it, expect } from 'vitest'
import mongoose from 'mongoose'
import { createMockEvent } from '~/tests/h3-helpers'
import { createTestPhoto } from '~/tests/helpers'
import handler from '~/server/api/user/photo-count.get'

describe('GET /api/user/photo-count', () => {
  it('returns count of photos for authenticated user', async () => {
    const userId = new mongoose.Types.ObjectId()

    await createTestPhoto({ userId, slug: 'c1' })
    await createTestPhoto({ userId, slug: 'c2' })
    await createTestPhoto({ userId, slug: 'c3' })

    const event = createMockEvent({
      session: { user: { id: userId.toString(), email: 'admin@test.com' } },
    })
    const result = await handler(event as any)

    expect(result.count).toBe(3)
  })

  it('does not count other users photos', async () => {
    const myId = new mongoose.Types.ObjectId()
    const otherId = new mongoose.Types.ObjectId()

    await createTestPhoto({ userId: myId, slug: 'mine-1' })
    await createTestPhoto({ userId: myId, slug: 'mine-2' })
    await createTestPhoto({ userId: otherId, slug: 'other-1' })

    const event = createMockEvent({
      session: { user: { id: myId.toString(), email: 'admin@test.com' } },
    })
    const result = await handler(event as any)

    expect(result.count).toBe(2)
  })

  it('returns 0 when user has no photos', async () => {
    const userId = new mongoose.Types.ObjectId()

    const event = createMockEvent({
      session: { user: { id: userId.toString(), email: 'admin@test.com' } },
    })
    const result = await handler(event as any)

    expect(result.count).toBe(0)
  })
})
