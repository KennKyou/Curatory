import { describe, it, expect } from 'vitest'
import mongoose from 'mongoose'
import { createMockEvent } from '~/tests/h3-helpers'
import { createTestPhoto } from '~/tests/helpers'
import handler from '~/server/api/platform/photos.get'

const userId = new mongoose.Types.ObjectId()
const session = { user: { id: userId.toString(), email: 'test@example.com' } }

describe('platform/photos.get', () => {
  it('returns photos with hasMore and lastId', async () => {
    await createTestPhoto({ userId, key: 'a.jpg', slug: 'get-a', takenAt: new Date('2024-01-01') })
    await createTestPhoto({ userId, key: 'b.jpg', slug: 'get-b', takenAt: new Date('2024-01-02') })

    const event = createMockEvent({ session })
    const result = await handler(event)

    expect(result.photos).toHaveLength(2)
    expect(result.hasMore).toBe(false)
    expect(result.lastId).toBeTruthy()
  })

  it('returns selected photos by ids outside normal pagination', async () => {
    const selected = await createTestPhoto({ userId, key: 'selected.jpg', slug: 'get-selected', takenAt: new Date('2024-01-01') })
    const unselected = await createTestPhoto({ userId, key: 'unselected.jpg', slug: 'get-unselected', takenAt: new Date('2024-01-02') })
    const otherUserPhoto = await createTestPhoto({
      userId: new mongoose.Types.ObjectId(),
      key: 'other-selected.jpg',
      slug: 'get-other-selected',
      takenAt: new Date('2024-01-03'),
    })

    const event = createMockEvent({
      session,
      query: {
        ids: `${selected._id.toString()},${otherUserPhoto._id.toString()},not-valid`,
        lastId: unselected._id.toString(),
      },
    })
    const result = await handler(event)

    expect(result.photos).toHaveLength(1)
    expect(result.photos[0].key).toBe('selected.jpg')
    expect(result.hasMore).toBe(false)
    expect(result.lastId).toBe(null)
  })

  it('supports cursor-based pagination', async () => {
    // Create more than 50 photos to trigger hasMore
    const photos = []
    for (let i = 0; i < 52; i++) {
      photos.push(createTestPhoto({
        userId,
        key: `page/photo-${String(i).padStart(3, '0')}.jpg`,
        slug: `page-${i}`,
        takenAt: new Date(2024, 0, 1, 0, 0, i),
      }))
    }
    await Promise.all(photos)

    // First page
    const event1 = createMockEvent({ session })
    const page1 = await handler(event1)

    expect(page1.photos).toHaveLength(50)
    expect(page1.hasMore).toBe(true)
    expect(page1.lastId).toBeTruthy()

    // Second page using cursor
    const event2 = createMockEvent({ session, query: { lastId: page1.lastId! } })
    const page2 = await handler(event2)

    expect(page2.photos).toHaveLength(2)
    expect(page2.hasMore).toBe(false)
  })

  it('does not return photos from other users', async () => {
    const otherUserId = new mongoose.Types.ObjectId()
    await createTestPhoto({ userId: otherUserId, key: 'other.jpg', slug: 'other-user-get', takenAt: new Date() })
    await createTestPhoto({ userId, key: 'mine.jpg', slug: 'my-get', takenAt: new Date() })

    const event = createMockEvent({ session })
    const result = await handler(event)

    expect(result.photos).toHaveLength(1)
    expect(result.photos[0].key).toBe('mine.jpg')
  })
})
