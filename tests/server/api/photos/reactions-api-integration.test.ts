import { describe, it, expect, beforeEach } from 'vitest'
import mongoose from 'mongoose'
import { randomUUID } from 'node:crypto'
import { createMockEvent } from '~/tests/h3-helpers'
import { createTestPhoto, createTestUser } from '~/tests/helpers'
import { Reaction } from '~/server/models/Reaction'
import { Photo } from '~/server/models/Photo'
import listHandler from '~/server/api/photos/index.get'
import slugHandler from '~/server/api/photos/[slug].get'

describe('Photo list/single API includes denormalized reaction fields', () => {
  let userId: mongoose.Types.ObjectId

  beforeEach(async () => {
    const user = await createTestUser({ email: 'admin@test.com', name: 'Admin' })
    userId = user._id as mongoose.Types.ObjectId
  })

  it('list API returns topReaction and reactionTotal for every photo', async () => {
    const photo = await createTestPhoto({ userId, slug: 'api-list-1' })

    // Simulate prior reactions by directly updating denormalized counters
    await Photo.updateOne(
      { _id: photo._id },
      {
        $set: {
          'reactionCounts.fire': 2,
          'reactionCounts.heartEyes': 1,
          reactionTotal: 3,
          topReaction: 'fire',
        },
      },
    )

    const result = await listHandler(createMockEvent({ query: {} }) as any)
    expect(result.photos).toHaveLength(1)
    expect(result.photos[0].topReaction).toBe('fire')
    expect(result.photos[0].reactionTotal).toBe(3)
  })

  it('list API returns null topReaction and zero reactionTotal for untouched photo', async () => {
    await createTestPhoto({ userId, slug: 'api-list-empty' })

    const result = await listHandler(createMockEvent({ query: {} }) as any)
    expect(result.photos[0].topReaction).toBeNull()
    expect(result.photos[0].reactionTotal).toBe(0)
  })

  it('single API returns full reactionCounts with all six keys', async () => {
    const photo = await createTestPhoto({ userId, slug: 'api-single' })

    await Photo.updateOne(
      { _id: photo._id },
      {
        $set: {
          'reactionCounts.fire': 5,
          reactionTotal: 5,
          topReaction: 'fire',
        },
      },
    )

    const result = await slugHandler(
      createMockEvent({ params: { slug: 'api-single' } }) as any,
    )

    expect(result.reactionCounts).toBeDefined()
    expect(result.reactionCounts.heartEyes).toBe(0)
    expect(result.reactionCounts.starStruck).toBe(0)
    expect(result.reactionCounts.thumbsUp).toBe(0)
    expect(result.reactionCounts.fire).toBe(5)
    expect(result.reactionCounts.raisedHands).toBe(0)
    expect(result.reactionCounts.camera).toBe(0)
    expect(result.topReaction).toBe('fire')
    expect(result.reactionTotal).toBe(5)
  })

  it('single API returns zero counts for photo with no reactions', async () => {
    await createTestPhoto({ userId, slug: 'api-single-empty' })

    const result = await slugHandler(
      createMockEvent({ params: { slug: 'api-single-empty' } }) as any,
    )

    expect(result.reactionCounts.fire).toBe(0)
    expect(result.reactionTotal).toBe(0)
    expect(result.topReaction).toBeNull()

    // Ensure no dangling Reaction records exist
    const count = await Reaction.countDocuments()
    expect(count).toBe(0)

    // silence unused import warning
    void randomUUID
  })
})
