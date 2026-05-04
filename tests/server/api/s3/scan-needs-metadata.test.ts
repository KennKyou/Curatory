import { describe, it, expect, vi, beforeEach } from 'vitest'
import mongoose from 'mongoose'
import { createMockEvent } from '~/tests/h3-helpers'
import { createMockS3Client, getStore } from '~/tests/s3-helpers'
import { createTestPhoto, createTestUser } from '~/tests/helpers'
import { Photo } from '~/server/models/Photo'
import { getS3Client } from '~/server/utils/s3client'

// Mock generateThumbnail so we can simulate a stripped R2 file producing null EXIF
vi.mock('~/server/utils/thumbnail', () => ({
  generateThumbnail: vi.fn(),
}))
vi.mock('~~/server/utils/thumbnail', () => ({
  generateThumbnail: vi.fn(),
}))

import { generateThumbnail } from '~/server/utils/thumbnail'
import handler from '~/server/api/s3/scan.post'

function makeEvent(session: { user: { id: string; email: string } }) {
  const event = createMockEvent({ session }) as any
  event.node = {
    res: {
      write: vi.fn(),
      end: vi.fn(),
    },
  }
  return event
}

describe('scan.post needsMetadata EXIF preservation', () => {
  let mockClient: ReturnType<typeof createMockS3Client>

  beforeEach(() => {
    mockClient = createMockS3Client()
    vi.mocked(getS3Client).mockReturnValue(mockClient as any)
  })

  it('does not overwrite upload-populated EXIF fields when R2 file is stripped', async () => {
    const user = await createTestUser({ email: 'admin@test.com' })
    const userId = user._id as mongoose.Types.ObjectId

    const gpsExif = {
      Image: { Make: 'Canon' },
      GPSInfo: { GPSLatitude: [25, 2, 30], GPSLongitudeRef: 'E' },
    }

    const photo = await createTestPhoto({
      userId,
      key: 'travel/uploaded.jpg',
      slug: 'uploaded-photo',
      thumbnailUrl: null, // triggers needsMetadata branch
      exif: gpsExif,
      takenAt: new Date('2024-01-01T00:00:00Z'),
      width: 4000,
      height: 3000,
      cameraName: 'Canon',
      lensName: 'RF 24-70',
    })

    // Seed the S3 store so the key exists in the listing
    const store = getStore(mockClient)
    store.set('travel/uploaded.jpg', Buffer.from('fake-stripped-bytes'))

    // generateThumbnail simulates reading the stripped R2 file → null EXIF fields
    vi.mocked(generateThumbnail).mockResolvedValue({
      takenAt: null,
      exif: null,
      toneAnalysis: { toneType: 'Normal', brightness: 50, contrast: 40, shadowRatio: 10, highlightRatio: 10, histogram: new Array(256).fill(0) },
      width: null,
      height: null,
      blurDataUrl: 'data:image/jpeg;base64,abc',
      cameraName: null,
      lensName: null,
    })

    const event = makeEvent({ user: { id: userId.toString(), email: 'admin@test.com' } })
    await handler(event as any)

    const updated = await Photo.findById(photo._id).lean()
    expect(updated).not.toBeNull()
    // Upload-populated EXIF fields must be preserved
    expect((updated!.exif as any).GPSInfo.GPSLatitude).toEqual([25, 2, 30])
    expect(updated!.takenAt).toEqual(new Date('2024-01-01T00:00:00Z'))
    expect(updated!.width).toBe(4000)
    expect(updated!.height).toBe(3000)
    expect(updated!.cameraName).toBe('Canon')
    expect(updated!.lensName).toBe('RF 24-70')
    // Thumbnail + blur + tone are refreshed
    expect(updated!.thumbnailUrl).toBeTruthy()
    expect(updated!.blurDataUrl).toBe('data:image/jpeg;base64,abc')
    expect(updated!.toneAnalysis).not.toBeNull()
  })

  it('populates null EXIF fields when R2 file still has metadata', async () => {
    const user = await createTestUser({ email: 'admin@test.com' })
    const userId = user._id as mongoose.Types.ObjectId

    const photo = await createTestPhoto({
      userId,
      key: 'direct/bucket-drop.jpg',
      slug: 'bucket-drop',
      thumbnailUrl: null,
      exif: null,
      takenAt: null,
      width: null,
      height: null,
      cameraName: null,
      lensName: null,
    })

    const store = getStore(mockClient)
    store.set('direct/bucket-drop.jpg', Buffer.from('fake-bytes'))

    vi.mocked(generateThumbnail).mockResolvedValue({
      takenAt: new Date('2023-06-15T12:00:00Z'),
      exif: { Image: { Make: 'Sony' } },
      toneAnalysis: null,
      width: 1920,
      height: 1080,
      blurDataUrl: null,
      cameraName: 'Sony',
      lensName: 'FE 50mm',
    })

    const event = makeEvent({ user: { id: userId.toString(), email: 'admin@test.com' } })
    await handler(event as any)

    const updated = await Photo.findById(photo._id).lean()
    expect(updated!.exif).toEqual({ Image: { Make: 'Sony' } })
    expect(updated!.takenAt).toEqual(new Date('2023-06-15T12:00:00Z'))
    expect(updated!.width).toBe(1920)
    expect(updated!.height).toBe(1080)
    expect(updated!.cameraName).toBe('Sony')
    expect(updated!.lensName).toBe('FE 50mm')
  })
})
