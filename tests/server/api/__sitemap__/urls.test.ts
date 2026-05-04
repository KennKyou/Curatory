import { describe, it, expect } from 'vitest'
import { createMockEvent } from '~/tests/h3-helpers'
import { createTestUser, createTestPhoto } from '~/tests/helpers'
import handler from '~/server/api/__sitemap__/urls.get'

describe('__sitemap__/urls.get', () => {
  it('returns photo URLs with lastmod and images for sitemap', async () => {
    const admin = await createTestUser({ email: 'admin@test.com' })
    const photo = await createTestPhoto({
      userId: admin._id,
      slug: 'sunset-beach',
      thumbnailUrl: 'https://cdn.example.com/thumb/sunset.jpg',
    })

    const event = createMockEvent({})
    const result = await handler(event) as Array<{ loc: string, lastmod: Date, images: Array<{ loc: string }> }>

    expect(result).toHaveLength(1)
    expect(result[0].loc).toBe('/photos/sunset-beach')
    expect(result[0].lastmod).toEqual(photo.createdAt)
    expect(result[0].images).toEqual([{ loc: 'https://cdn.example.com/thumb/sunset.jpg' }])
  })

  it('falls back to url when thumbnailUrl is null', async () => {
    const admin = await createTestUser({ email: 'admin@test.com' })
    await createTestPhoto({
      userId: admin._id,
      slug: 'raw-photo',
      url: 'https://cdn.example.com/raw.jpg',
      thumbnailUrl: null,
    })

    const event = createMockEvent({})
    const result = await handler(event) as Array<{ loc: string, images: Array<{ loc: string }> }>

    expect(result[0].images).toEqual([{ loc: 'https://cdn.example.com/raw.jpg' }])
  })

  it('returns empty array when no admin user exists', async () => {
    const event = createMockEvent({})
    const result = await handler(event)

    expect(result).toEqual([])
  })

  it('returns empty array when admin has no photos', async () => {
    await createTestUser({ email: 'admin@test.com' })

    const event = createMockEvent({})
    const result = await handler(event)

    expect(result).toEqual([])
  })

  it('returns multiple photo URLs', async () => {
    const admin = await createTestUser({ email: 'admin@test.com' })
    await createTestPhoto({ userId: admin._id, slug: 'photo-1' })
    await createTestPhoto({ userId: admin._id, slug: 'photo-2' })
    await createTestPhoto({ userId: admin._id, slug: 'photo-3' })

    const event = createMockEvent({})
    const result = await handler(event) as Array<{ loc: string, lastmod: Date }>

    expect(result).toHaveLength(3)
    const locs = result.map(r => r.loc)
    expect(locs).toContain('/photos/photo-1')
    expect(locs).toContain('/photos/photo-2')
    expect(locs).toContain('/photos/photo-3')
  })
})
