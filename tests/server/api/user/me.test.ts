import { describe, it, expect } from 'vitest'
import mongoose from 'mongoose'
import { createMockEvent } from '~/tests/h3-helpers'
import { createTestUser } from '~/tests/helpers'
import handler from '~/server/api/user/me.get'

describe('user/me.get', () => {
  it('returns user data for the signed-in administrator account', async () => {
    const user = await createTestUser({ email: 'curator@test.com', name: 'Curator' })
    const event = createMockEvent({
      session: { user: { id: user._id.toString(), email: user.email } },
    })

    const result = await handler(event)

    expect(result.email).toBe('curator@test.com')
    expect(result.name).toBe('Curator')
    expect(result.isAdmin).toBe(true)
    expect(result.id).toBeDefined()
    expect(result.avatar).toBeDefined()
  })

  it('throws 404 when user not found in DB', async () => {
    const fakeId = new mongoose.Types.ObjectId()
    const event = createMockEvent({
      session: { user: { id: fakeId.toString(), email: 'ghost@test.com' } },
    })

    await expect(handler(event)).rejects.toThrow('User not found')
  })
})
