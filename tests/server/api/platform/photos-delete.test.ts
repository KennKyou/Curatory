import { describe, it, expect, vi, beforeEach } from 'vitest'
import mongoose from 'mongoose'
import { createMockEvent } from '~/tests/h3-helpers'
import { createMockS3Client, getStore } from '~/tests/s3-helpers'
import { createTestPhoto } from '~/tests/helpers'
import { Photo } from '~/server/models/Photo'
import { getS3Client } from '~/server/utils/s3client'
import handler from '~/server/api/platform/photos.delete'

const userId = new mongoose.Types.ObjectId()
const session = { user: { id: userId.toString(), email: 'test@example.com' } }

describe('platform/photos.delete', () => {
  let mockClient: ReturnType<typeof createMockS3Client>

  beforeEach(() => {
    mockClient = createMockS3Client()
    vi.mocked(getS3Client).mockReturnValue(mockClient as any)
  })

  it('deletes photo from S3 (original + thumbnail) and DB', async () => {
    const store = getStore(mockClient)
    const key = 'travel/photo.jpg'
    const thumbKey = `.curatory/thumbnails/${key}.jpg`
    store.set(key, Buffer.from('original'))
    store.set(thumbKey, Buffer.from('thumb'))

    const photo = await createTestPhoto({ userId, key, slug: 'del-test-slug' })

    const event = createMockEvent({
      session,
      body: { ids: [photo._id.toString()] },
    })

    const result = await handler(event)

    expect(result.deleted).toBe(1)
    expect(store.has(key)).toBe(false)
    expect(store.has(thumbKey)).toBe(false)

    const dbPhoto = await Photo.findById(photo._id)
    expect(dbPhoto).toBeNull()
  })

  it('throws 400 when ids is empty', async () => {
    const event = createMockEvent({
      session,
      body: { ids: [] },
    })

    await expect(handler(event)).rejects.toThrow('No photo IDs provided')
  })

  it('throws 404 when all ids belong to another user', async () => {
    const otherUserId = new mongoose.Types.ObjectId()
    const photo = await createTestPhoto({ userId: otherUserId, slug: 'other-user-photo' })

    const event = createMockEvent({
      session,
      body: { ids: [photo._id.toString()] },
    })

    await expect(handler(event)).rejects.toThrow('No matching photos found')
  })

  it('only deletes photos belonging to the current user', async () => {
    const otherUserId = new mongoose.Types.ObjectId()
    const store = getStore(mockClient)

    const myKey = 'my/photo.jpg'
    const otherKey = 'other/photo.jpg'
    store.set(myKey, Buffer.from('mine'))
    store.set(otherKey, Buffer.from('theirs'))

    const myPhoto = await createTestPhoto({ userId, key: myKey, slug: 'my-photo-slug' })
    const otherPhoto = await createTestPhoto({ userId: otherUserId, key: otherKey, slug: 'other-photo-slug' })

    const event = createMockEvent({
      session,
      body: { ids: [myPhoto._id.toString(), otherPhoto._id.toString()] },
    })

    const result = await handler(event)

    expect(result.deleted).toBe(1)
    expect(store.has(myKey)).toBe(false)
    // Other user's photo should remain in S3
    expect(store.has(otherKey)).toBe(true)

    const otherDb = await Photo.findById(otherPhoto._id)
    expect(otherDb).not.toBeNull()
  })
})
