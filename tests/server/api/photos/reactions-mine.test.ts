import { describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createMockEvent } from '~/tests/h3-helpers'
import { createTestPhoto, createTestUser } from '~/tests/helpers'
import { Reaction } from '~/server/models/Reaction'
import handler from '~/server/api/photos/reactions/mine.get'

describe('GET /api/photos/reactions/mine (Visitor reaction lookup endpoint)', () => {
  it('returns all reactions for the given fingerprint across admin photos', async () => {
    const admin = await createTestUser({ email: 'admin@test.com' })
    const photoA = await createTestPhoto({ userId: admin._id, slug: 'mine-a' })
    const photoB = await createTestPhoto({ userId: admin._id, slug: 'mine-b' })
    const fp = randomUUID()

    await Reaction.create({ photoId: photoA._id, emoji: 'fire', fingerprintId: fp })
    await Reaction.create({ photoId: photoA._id, emoji: 'heartEyes', fingerprintId: fp })
    await Reaction.create({ photoId: photoB._id, emoji: 'thumbsUp', fingerprintId: fp })

    const event = createMockEvent({ query: { fingerprintId: fp } })
    const result = await handler(event as any)

    expect(result.reactions).toHaveLength(3)
    const pairs = result.reactions.map((r) => `${r.photoSlug}:${r.emoji}`).sort()
    expect(pairs).toEqual(['mine-a:fire', 'mine-a:heartEyes', 'mine-b:thumbsUp'])
  })

  it('returns empty array for fingerprint with no reactions', async () => {
    await createTestUser({ email: 'admin@test.com' })
    const event = createMockEvent({ query: { fingerprintId: randomUUID() } })
    const result = await handler(event as any)
    expect(result.reactions).toEqual([])
  })

  it('rejects missing fingerprintId with 400', async () => {
    const event = createMockEvent({ query: {} })
    await expect(handler(event as any)).rejects.toThrow('Invalid fingerprintId')
  })

  it('rejects invalid fingerprintId format with 400', async () => {
    const event = createMockEvent({ query: { fingerprintId: 'not-a-uuid' } })
    await expect(handler(event as any)).rejects.toThrow('Invalid fingerprintId')
  })

  it('excludes reactions on photos owned by non-admin users', async () => {
    const admin = await createTestUser({ email: 'admin@test.com' })
    const other = await createTestUser({ email: 'other@example.com' })
    const adminPhoto = await createTestPhoto({ userId: admin._id, slug: 'mine-admin' })
    const otherPhoto = await createTestPhoto({ userId: other._id, slug: 'mine-other' })
    const fp = randomUUID()

    await Reaction.create({ photoId: adminPhoto._id, emoji: 'fire', fingerprintId: fp })
    await Reaction.create({ photoId: otherPhoto._id, emoji: 'fire', fingerprintId: fp })

    const event = createMockEvent({ query: { fingerprintId: fp } })
    const result = await handler(event as any)

    expect(result.reactions).toHaveLength(1)
    expect(result.reactions[0].photoSlug).toBe('mine-admin')
  })

  it('returns empty reactions when admin has no photos', async () => {
    await createTestUser({ email: 'admin@test.com' })
    const event = createMockEvent({ query: { fingerprintId: randomUUID() } })
    const result = await handler(event as any)
    expect(result.reactions).toEqual([])
  })
})
