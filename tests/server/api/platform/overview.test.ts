import { describe, it, expect } from 'vitest'
import mongoose from 'mongoose'
import { createMockEvent } from '~/tests/h3-helpers'
import { createTestPhoto } from '~/tests/helpers'
import handler from '~/server/api/platform/overview.get'

const userId = new mongoose.Types.ObjectId()
const session = { user: { id: userId.toString(), email: 'test@example.com' } }

describe('platform/overview.get', () => {
  it('returns correct stats when photos exist', async () => {
    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15)

    await createTestPhoto({ userId, key: 'a.jpg', slug: 'ov-a', size: 1000, createdAt: now, takenAt: now })
    await createTestPhoto({ userId, key: 'b.jpg', slug: 'ov-b', size: 2000, createdAt: now, takenAt: now })
    await createTestPhoto({ userId, key: 'c.jpg', slug: 'ov-c', size: 3000, createdAt: lastMonth, takenAt: lastMonth })

    const event = createMockEvent({ session })
    const result = await handler(event)

    expect(result.totalPhotos).toBe(3)
    expect(result.storageUsed).toBe(6000)
    expect(result.averagePhotoSize).toBe(2000)
    expect(result.uploadsThisMonth).toBe(2)
  })

  it('returns recent activity with correct fields', async () => {
    await createTestPhoto({ userId, key: 'travel/photo.jpg', slug: 'ov-recent', size: 500, takenAt: new Date() })

    const event = createMockEvent({ session })
    const result = await handler(event)

    expect(result.recentActivity).toHaveLength(1)
    expect(result.recentActivity[0].type).toBe('upload')
    expect(result.recentActivity[0].name).toBe('photo')
    expect(result.recentActivity[0].key).toBe('travel/photo.jpg')
  })

  it('returns zeros when no photos', async () => {
    const event = createMockEvent({ session })
    const result = await handler(event)

    expect(result.totalPhotos).toBe(0)
    expect(result.storageUsed).toBe(0)
    expect(result.averagePhotoSize).toBe(0)
    expect(result.recentActivity).toEqual([])
  })

  it('does not include other user photos', async () => {
    const otherUserId = new mongoose.Types.ObjectId()
    await createTestPhoto({ userId: otherUserId, key: 'other.jpg', slug: 'ov-other', size: 9999, takenAt: new Date() })
    await createTestPhoto({ userId, key: 'mine.jpg', slug: 'ov-mine', size: 100, takenAt: new Date() })

    const event = createMockEvent({ session })
    const result = await handler(event)

    expect(result.totalPhotos).toBe(1)
    expect(result.storageUsed).toBe(100)
  })
})
