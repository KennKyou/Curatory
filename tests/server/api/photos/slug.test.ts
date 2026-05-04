import { describe, it, expect } from 'vitest'
import mongoose from 'mongoose'
import { createMockEvent } from '~/tests/h3-helpers'
import { createTestPhoto, createTestSiteSettings } from '~/tests/helpers'
import handler from '~/server/api/photos/[slug].get'

describe('GET /api/photos/[slug]', () => {
  it('returns photo data by slug', async () => {
    const photo = await createTestPhoto({ slug: 'test-slug', size: 2048 })
    const event = createMockEvent({ params: { slug: 'test-slug' } })

    const result = await handler(event as any)

    expect(result.id.toString()).toBe(photo._id.toString())
    expect(result.slug).toBe('test-slug')
    expect(result.size).toBe(2048)
    expect(result.url).toBeDefined()
    expect(result).not.toHaveProperty('labels')
  })

  it('throws 404 for non-existent slug', async () => {
    const event = createMockEvent({ params: { slug: 'does-not-exist' } })
    await expect(handler(event as any)).rejects.toThrow('Photo not found')
  })

  it('throws 400 when slug is missing', async () => {
    const event = createMockEvent({ params: {} })
    await expect(handler(event as any)).rejects.toThrow('Slug is required')
  })

  it('returns nullable fields as null', async () => {
    await createTestPhoto({ slug: 'nullable-test' })
    const event = createMockEvent({ params: { slug: 'nullable-test' } })

    const result = await handler(event as any)

    expect(result.width).toBeNull()
    expect(result.height).toBeNull()
    expect(result.exif).toBeNull()
    expect(result.takenAt).toBeNull()
    expect(result.toneAnalysis).toBeNull()
  })

  describe('GPS filtering by showGpsInfo', () => {
    const gpsExif = {
      Image: { Make: 'Canon' },
      GPSInfo: {
        GPSLatitude: [25, 2, 30],
        GPSLongitude: [121, 33, 15],
        GPSLatitudeRef: 'N',
        GPSLongitudeRef: 'E',
      },
    }

    it('hides GPSInfo when showGpsInfo is false', async () => {
      const userId = new mongoose.Types.ObjectId()
      await createTestSiteSettings({ userId, showGpsInfo: false })
      await createTestPhoto({ userId, slug: 'gps-off', exif: gpsExif })

      const event = createMockEvent({ params: { slug: 'gps-off' } })
      const result = await handler(event as any)

      expect(result.exif).toBeDefined()
      expect((result.exif as any).GPSInfo).toBeUndefined()
      expect((result.exif as any).Image.Make).toBe('Canon')
    })

    it('returns GPSInfo when showGpsInfo is true', async () => {
      const userId = new mongoose.Types.ObjectId()
      await createTestSiteSettings({ userId, showGpsInfo: true })
      await createTestPhoto({ userId, slug: 'gps-on', exif: gpsExif })

      const event = createMockEvent({ params: { slug: 'gps-on' } })
      const result = await handler(event as any)

      expect((result.exif as any).GPSInfo).toBeDefined()
      expect((result.exif as any).GPSInfo.GPSLatitude).toEqual([25, 2, 30])
    })

    it('defaults to stripping GPS when SiteSettings are missing', async () => {
      await createTestPhoto({ slug: 'gps-default', exif: gpsExif })

      const event = createMockEvent({ params: { slug: 'gps-default' } })
      const result = await handler(event as any)

      expect((result.exif as any).GPSInfo).toBeUndefined()
    })
  })
})
