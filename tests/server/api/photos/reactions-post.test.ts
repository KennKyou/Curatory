import { describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createMockEvent } from '~/tests/h3-helpers'
import { createTestPhoto } from '~/tests/helpers'
import { Photo } from '~/server/models/Photo'
import { Reaction } from '~/server/models/Reaction'
import handler from '~/server/api/photos/[slug]/reactions.post'

const FP = () => randomUUID()

describe('POST /api/photos/[slug]/reactions (Toggle reaction endpoint)', () => {
  it('adds a reaction on first call', async () => {
    const photo = await createTestPhoto({ slug: 'r-add' })
    const fingerprintId = FP()

    const event = createMockEvent({
      params: { slug: 'r-add' },
      body: { emoji: 'fire', fingerprintId },
    })

    const result = await handler(event as any)

    expect(result.action).toBe('added')
    expect(result.reactionCounts.fire).toBe(1)
    expect(result.reactionTotal).toBe(1)
    expect(result.topReaction).toBe('fire')

    const reactions = await Reaction.find({ photoId: photo._id })
    expect(reactions.length).toBe(1)

    const refreshed = await Photo.findById(photo._id).lean()
    expect(refreshed!.reactionCounts.fire).toBe(1)
    expect(refreshed!.reactionTotal).toBe(1)
    expect(refreshed!.topReaction).toBe('fire')
  })

  it('removes the reaction on second identical call (toggle)', async () => {
    const photo = await createTestPhoto({ slug: 'r-toggle' })
    const fingerprintId = FP()
    const body = { emoji: 'fire', fingerprintId }

    await handler(createMockEvent({ params: { slug: 'r-toggle' }, body }) as any)
    const second = await handler(
      createMockEvent({ params: { slug: 'r-toggle' }, body }) as any,
    )

    expect(second.action).toBe('removed')
    expect(second.reactionCounts.fire).toBe(0)
    expect(second.reactionTotal).toBe(0)
    expect(second.topReaction).toBeNull()

    const reactions = await Reaction.find({ photoId: photo._id })
    expect(reactions.length).toBe(0)
  })

  it('recomputes topReaction based on highest count', async () => {
    await createTestPhoto({ slug: 'r-top' })

    // Three different visitors react with heartEyes, one with fire
    await handler(
      createMockEvent({
        params: { slug: 'r-top' },
        body: { emoji: 'heartEyes', fingerprintId: FP() },
      }) as any,
    )
    await handler(
      createMockEvent({
        params: { slug: 'r-top' },
        body: { emoji: 'heartEyes', fingerprintId: FP() },
      }) as any,
    )
    await handler(
      createMockEvent({
        params: { slug: 'r-top' },
        body: { emoji: 'heartEyes', fingerprintId: FP() },
      }) as any,
    )
    const result = await handler(
      createMockEvent({
        params: { slug: 'r-top' },
        body: { emoji: 'fire', fingerprintId: FP() },
      }) as any,
    )

    expect(result.topReaction).toBe('heartEyes')
    expect(result.reactionCounts.heartEyes).toBe(3)
    expect(result.reactionCounts.fire).toBe(1)
    expect(result.reactionTotal).toBe(4)
  })

  it('rejects invalid emoji with 400', async () => {
    await createTestPhoto({ slug: 'r-bad-emoji' })
    const event = createMockEvent({
      params: { slug: 'r-bad-emoji' },
      body: { emoji: 'sad', fingerprintId: FP() },
    })
    await expect(handler(event as any)).rejects.toThrow('Invalid emoji key')
  })

  it('rejects invalid fingerprint with 400', async () => {
    await createTestPhoto({ slug: 'r-bad-fp' })
    const event = createMockEvent({
      params: { slug: 'r-bad-fp' },
      body: { emoji: 'fire', fingerprintId: 'not-a-uuid' },
    })
    await expect(handler(event as any)).rejects.toThrow('Invalid fingerprintId')
  })

  it('rejects missing fingerprint with 400', async () => {
    await createTestPhoto({ slug: 'r-missing-fp' })
    const event = createMockEvent({
      params: { slug: 'r-missing-fp' },
      body: { emoji: 'fire' },
    })
    await expect(handler(event as any)).rejects.toThrow('Invalid fingerprintId')
  })

  it('returns 404 for unknown slug', async () => {
    const event = createMockEvent({
      params: { slug: 'does-not-exist' },
      body: { emoji: 'fire', fingerprintId: FP() },
    })
    await expect(handler(event as any)).rejects.toThrow('Photo not found')
  })

  it('unique index prevents duplicate reactions from racing', async () => {
    const photo = await createTestPhoto({ slug: 'r-race' })
    const fingerprintId = FP()

    // Simulate: reaction already exists in DB from a prior race winner.
    await Reaction.create({ photoId: photo._id, emoji: 'fire', fingerprintId })

    // A second attempt to "add" via the endpoint detects existing and removes.
    const event = createMockEvent({
      params: { slug: 'r-race' },
      body: { emoji: 'fire', fingerprintId },
    })
    const result = await handler(event as any)

    expect(result.action).toBe('removed')
    const reactions = await Reaction.find({ photoId: photo._id })
    expect(reactions.length).toBe(0)
  })

  it('counter floor does not go below zero even with drift', async () => {
    const photo = await createTestPhoto({ slug: 'r-floor' })
    const fingerprintId = FP()

    // Drift: Reaction exists but counters are already zero (simulating
    // prior compensation-strategy failure).
    await Reaction.create({ photoId: photo._id, emoji: 'fire', fingerprintId })

    const event = createMockEvent({
      params: { slug: 'r-floor' },
      body: { emoji: 'fire', fingerprintId },
    })
    const result = await handler(event as any)

    expect(result.action).toBe('removed')
    expect(result.reactionCounts.fire).toBe(0)
    expect(result.reactionTotal).toBe(0)
  })
})
