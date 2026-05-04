import { describe, it, expect, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import { createMockEvent } from '~/tests/h3-helpers'
import { createTestPhoto, createTestSiteSettings, createTestUser } from '~/tests/helpers'
import { Photo } from '~/server/models/Photo'
import handler from '~/server/api/photos/index.get'

describe('GET /api/photos', () => {
  let userId: mongoose.Types.ObjectId

  beforeEach(async () => {
    vi.restoreAllMocks()
    const user = await createTestUser({ email: 'admin@test.com', name: 'Admin' })
    userId = user._id as mongoose.Types.ObjectId
  })

  it('returns paginated photo list with user info', async () => {
    await createTestPhoto({ userId, slug: 'photo-1', takenAt: new Date('2026-01-01') })
    await createTestPhoto({ userId, slug: 'photo-2', takenAt: new Date('2026-01-02') })

    const result = await handler(createMockEvent({ query: {} }) as any)

    expect(result.photos.map(photo => photo.slug)).toEqual(['photo-2', 'photo-1'])
    expect(result.pagination.page).toBe(1)
    expect(result.pagination.total).toBe(2)
    expect(result.pagination.hasMore).toBe(false)
    expect(result.user.name).toBe('Admin')
  })

  it('paginates with page parameter', async () => {
    for (let i = 0; i < 31; i++) {
      await createTestPhoto({
        userId,
        slug: `page-photo-${i}`,
        takenAt: new Date(2026, 0, i + 1),
        lastModified: new Date(2026, 0, i + 1),
      })
    }

    const page1 = await handler(createMockEvent({ query: { page: '1' } }) as any)
    const page2 = await handler(createMockEvent({ query: { page: '2' } }) as any)

    expect(page1.photos).toHaveLength(30)
    expect(page1.pagination.hasMore).toBe(true)
    expect(page2.photos).toHaveLength(1)
    expect(page2.pagination.hasMore).toBe(false)
  })

  it('normalizes invalid and below-one page values to page 1', async () => {
    await createTestPhoto({ userId, slug: 'page-normalized' })

    const invalid = await handler(createMockEvent({ query: { page: 'abc' } }) as any)
    const zero = await handler(createMockEvent({ query: { page: '0' } }) as any)
    const decimal = await handler(createMockEvent({ query: { page: '1.5' } }) as any)

    expect(invalid.pagination.page).toBe(1)
    expect(zero.pagination.page).toBe(1)
    expect(decimal.pagination.page).toBe(1)
  })

  it('rejects excessive page values before running the paginated Photo query', async () => {
    const findSpy = vi.spyOn(Photo, 'find')

    await expect(handler(createMockEvent({ query: { page: '101' } }) as any)).rejects.toThrow()
    expect(findSpy).not.toHaveBeenCalled()
  })

  it('returns exhibition selections without changing first-page photo ordering', async () => {
    const photos = []
    for (let i = 0; i < 35; i++) {
      photos.push(await createTestPhoto({
        userId,
        slug: `exhibition-page-photo-${i}`,
        takenAt: new Date(2026, 1, i + 1),
        lastModified: new Date(2026, 1, i + 1),
      }))
    }
    const selectedOutsideFirstPage = photos.slice(0, 3)
    await createTestSiteSettings({
      userId,
      exhibition: {
        coverPhotoId: selectedOutsideFirstPage[0]?._id,
        title: 'Exhibition',
        subtitle: '',
        description: '',
        startDate: null,
        endDate: null,
        theme: 'white',
        coverTextColor: 'white',
        coverProtection: 'auto',
        sections: [
          {
            id: 'section-a',
            layout: 'media',
            theme: 'black',
            title: 'Room',
            body: 'Body',
            photoIds: [selectedOutsideFirstPage[1]?._id, selectedOutsideFirstPage[2]?._id],
            textPosition: 'left',
            reserveTextSpace: false,
          },
        ],
      },
    })

    const result = await handler(createMockEvent({ query: { page: '1' } }) as any)

    expect(result.photos).toHaveLength(30)
    expect(result.photos.map(photo => photo.slug)).toEqual(
      Array.from({ length: 30 }, (_, index) => `exhibition-page-photo-${34 - index}`),
    )
    expect(result.exhibitionSelection.coverPhoto?.id.toString()).toBe(selectedOutsideFirstPage[0]?._id.toString())
    expect(result.exhibitionSelection.sections).toEqual([
      {
        id: 'section-a',
        photos: [
          expect.objectContaining({ id: selectedOutsideFirstPage[1]?._id }),
          expect.objectContaining({ id: selectedOutsideFirstPage[2]?._id }),
        ],
      },
    ])
  })

  it('omits exhibition selections after the first page', async () => {
    const cover = await createTestPhoto({ userId, slug: 'exhibition-cover' })
    await createTestSiteSettings({
      userId,
      exhibition: {
        coverPhotoId: cover._id,
        title: 'Exhibition',
        sections: [{
          id: 'section-a',
          layout: 'media',
          theme: 'white',
          title: '',
          body: '',
          photoIds: [cover._id],
          textPosition: 'none',
          reserveTextSpace: false,
        }],
      },
    })

    const result = await handler(createMockEvent({ query: { page: '2' } }) as any)

    expect(result.exhibitionSelection.coverPhoto).toBeNull()
    expect(result.exhibitionSelection.sections).toEqual([])
  })

  it('strips GPS from public photo responses', async () => {
    await createTestPhoto({
      userId,
      slug: 'gps-photo',
      exif: {
        Image: { Make: 'Canon' },
        GPSInfo: { GPSLatitude: [25, 2, 30] },
      },
    })

    const result = await handler(createMockEvent({ query: {} }) as any)

    expect(result.photos[0].exif.Image.Make).toBe('Canon')
    expect(result.photos[0].exif.GPSInfo).toBeUndefined()
  })
})
