import { describe, it, expect } from 'vitest'
import { createTestPhoto } from '~/tests/helpers'
import { Photo } from '~/server/models/Photo'

describe('Photo model', () => {
  it('creates a photo with default values', async () => {
    const photo = await createTestPhoto()
    expect(photo._id).toBeDefined()
    expect(photo.slug).toMatch(/^test-photo-/)
    expect(photo.size).toBe(1024)
    expect(photo.reactionTotal).toBe(0)
  })

  it('creates a photo with overrides', async () => {
    const photo = await createTestPhoto({ slug: 'custom-slug', size: 2048 })
    const found = await Photo.findOne({ slug: 'custom-slug' })
    expect(found).not.toBeNull()
    expect(found!.size).toBe(2048)
  })

  it('clears collections between tests (no leftover data)', async () => {
    const count = await Photo.countDocuments()
    expect(count).toBe(0)
  })
})
