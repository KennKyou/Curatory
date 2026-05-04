import { describe, it, expect, vi, beforeEach } from 'vitest'
import mongoose from 'mongoose'
import sharp from 'sharp'
import { createMockEvent } from '~/tests/h3-helpers'
import { createMockS3Client, getStore } from '~/tests/s3-helpers'
import { Photo } from '~/server/models/Photo'
import { getS3Client } from '~/server/utils/s3client'
import { stripExifLossless as realStripExifLossless } from '~/server/utils/jpegStrip'
import handler from '~/server/api/platform/photos.post'

// Mock jpegStrip so individual tests can force the re-encode fallback via
// `vi.mocked(realStripExifLossless).mockReturnValueOnce(null)`. Default behavior
// delegates to the real implementation.
vi.mock('~/server/utils/jpegStrip', async () => {
  const actual = await vi.importActual<typeof import('~/server/utils/jpegStrip')>('~/server/utils/jpegStrip')
  return {
    stripExifLossless: vi.fn((buf: Buffer) => actual.stripExifLossless(buf)),
  }
})
vi.mock('~~/server/utils/jpegStrip', async () => {
  const actual = await vi.importActual<typeof import('~/server/utils/jpegStrip')>('~/server/utils/jpegStrip')
  return {
    stripExifLossless: vi.fn((buf: Buffer) => actual.stripExifLossless(buf)),
  }
})

const userId = new mongoose.Types.ObjectId()
const session = { user: { id: userId.toString(), email: 'test@example.com' } }

async function makeJpegBuffer(opts: {
  width?: number
  height?: number
  exif?: Parameters<sharp.Sharp['withExif']>[0]
} = {}): Promise<Buffer> {
  const { width = 20, height = 20, exif } = opts
  let pipeline = sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
  if (exif) pipeline = pipeline.withExif(exif)
  return pipeline.jpeg().toBuffer()
}

async function makeFilePart(filename: string, buffer?: Buffer, type = 'image/jpeg') {
  return {
    name: 'files',
    filename,
    data: buffer ?? (await makeJpegBuffer()),
    type,
  }
}

function makeRawFilePart(filename: string, data: Buffer, type: string) {
  return { name: 'files', filename, data, type }
}

describe('platform/photos.post', () => {
  let mockClient: ReturnType<typeof createMockS3Client>

  beforeEach(async () => {
    mockClient = createMockS3Client()
    vi.mocked(getS3Client).mockReturnValue(mockClient as any)
    // Reset stripExifLossless mock to delegate to real impl after any per-test override
    const actual = await vi.importActual<typeof import('~/server/utils/jpegStrip')>(
      '~/server/utils/jpegStrip',
    )
    vi.mocked(realStripExifLossless).mockImplementation((buf: Buffer) =>
      actual.stripExifLossless(buf),
    )
  })

  it('uploads a JPEG and creates S3 + DB records', async () => {
    const event = createMockEvent({ session }) as any
    event.__multipartFormData = [
      await makeFilePart('photo.jpg'),
    ]

    const result = await handler(event)

    expect(result.uploaded).toBe(1)
    expect(result.photos).toHaveLength(1)

    // S3 store should have the key
    const store = getStore(mockClient)
    expect(store.has('photo.jpg')).toBe(true)

    // DB should have the photo
    const photo = await Photo.findOne({ userId: userId.toString(), key: 'photo.jpg' })
    expect(photo).not.toBeNull()
    expect(photo!.slug).toBeTruthy()
    expect(photo!.url).toContain('photo.jpg')
  })

  it('adds numeric suffix when key already exists in S3', async () => {
    // Pre-populate S3 with existing key
    const store = getStore(mockClient)
    store.set('photo.jpg', Buffer.from('existing'))

    const event = createMockEvent({ session }) as any
    event.__multipartFormData = [
      await makeFilePart('photo.jpg'),
    ]

    const result = await handler(event)

    expect(result.uploaded).toBe(1)
    expect(result.photos[0].key).toBe('photo-2.jpg')
    expect(store.has('photo-2.jpg')).toBe(true)
  })

  it('rejects non-image files with error but continues others', async () => {
    const event = createMockEvent({ session }) as any
    event.__multipartFormData = [
      makeRawFilePart('doc.pdf', Buffer.alloc(100, 0x41), 'application/pdf'),
      await makeFilePart('photo.jpg'),
    ]

    const result = await handler(event)

    expect(result.uploaded).toBe(1)
    expect(result.errors).toBeDefined()
    expect(result.errors!.some((e: string) => e.includes('doc.pdf'))).toBe(true)
  })

  it('rejects files exceeding 20MB with error', async () => {
    const event = createMockEvent({ session }) as any
    const bigSize = 20 * 1024 * 1024 + 1
    event.__multipartFormData = [
      makeRawFilePart('big.jpg', Buffer.alloc(bigSize, 0x41), 'image/jpeg'),
    ]

    const result = await handler(event)

    expect(result.uploaded).toBe(0)
    expect(result.errors).toBeDefined()
    expect(result.errors![0]).toContain('20MB')
  })

  it('throws 400 when more than 20 files', async () => {
    const event = createMockEvent({ session }) as any
    const jpeg = await makeJpegBuffer()
    event.__multipartFormData = Array.from({ length: 21 }, (_, i) =>
      makeRawFilePart(`photo${i}.jpg`, jpeg, 'image/jpeg'),
    )

    await expect(handler(event)).rejects.toThrow('Maximum 20 files per upload')
  })

  it('throws 400 when formData is empty', async () => {
    const event = createMockEvent({ session }) as any
    event.__multipartFormData = []

    await expect(handler(event)).rejects.toThrow('No files provided')
  })

  it('strips EXIF from file on R2 but populates GPSInfo in DB', async () => {
    const jpeg = await makeJpegBuffer({
      exif: {
        IFD0: { Make: 'TestCam', Model: 'Model1' },
        IFD2: { LensModel: 'TestLens 50mm' },
        IFD3: {
          GPSLatitudeRef: 'N',
          GPSLatitude: '25/1 2/1 30/1',
          GPSLongitudeRef: 'E',
          GPSLongitude: '121/1 33/1 15/1',
        },
      },
    })

    const event = createMockEvent({ session }) as any
    event.__multipartFormData = [
      makeRawFilePart('gps.jpg', jpeg, 'image/jpeg'),
    ]

    const result = await handler(event)
    expect(result.uploaded).toBe(1)

    // R2 stored buffer must have no EXIF
    const store = getStore(mockClient)
    const storedBuffer = store.get('gps.jpg')
    expect(storedBuffer).toBeDefined()
    const storedMeta = await sharp(storedBuffer!).metadata()
    expect(storedMeta.exif).toBeUndefined()

    // DB record must preserve GPSInfo
    const photo = await Photo.findOne({ userId: userId.toString(), key: 'gps.jpg' })
    expect(photo).not.toBeNull()
    expect(photo!.exif).toBeDefined()
    expect((photo!.exif as any)?.GPSInfo).toBeDefined()
    expect((photo!.exif as any)?.GPSInfo.GPSLatitude).toEqual([25, 2, 30])
    expect((photo!.exif as any)?.GPSInfo.GPSLongitude).toEqual([121, 33, 15])
    expect(photo!.cameraName).toBe('TestCam Model1')
    expect(photo!.lensName).toBe('TestLens 50mm')
    expect(photo!.width).toBe(20)
    expect(photo!.height).toBe(20)
  })

  it('stores null metadata when uploaded image has no EXIF', async () => {
    const jpeg = await makeJpegBuffer()

    const event = createMockEvent({ session }) as any
    event.__multipartFormData = [
      makeRawFilePart('plain.jpg', jpeg, 'image/jpeg'),
    ]

    const result = await handler(event)
    expect(result.uploaded).toBe(1)

    const photo = await Photo.findOne({ userId: userId.toString(), key: 'plain.jpg' })
    expect(photo).not.toBeNull()
    expect(photo!.exif).toBeNull()
    expect(photo!.takenAt).toBeNull()
    expect(photo!.cameraName).toBeNull()
    expect(photo!.lensName).toBeNull()
    // width/height still populated from sharp metadata
    expect(photo!.width).toBe(20)
    expect(photo!.height).toBe(20)
  })

  it('rejects corrupt image with file-level error', async () => {
    const event = createMockEvent({ session }) as any
    event.__multipartFormData = [
      makeRawFilePart('bad.jpg', Buffer.from('not an image'), 'image/jpeg'),
      await makeFilePart('good.jpg'),
    ]

    const result = await handler(event)

    expect(result.uploaded).toBe(1)
    expect(result.errors).toBeDefined()
    expect(result.errors!.some((e: string) => e.includes('bad.jpg'))).toBe(true)

    // Only the good one reached S3
    const store = getStore(mockClient)
    expect(store.has('bad.jpg')).toBe(false)
    expect(store.has('good.jpg')).toBe(true)
  })

  describe('lossless strip preservation', () => {
    it('Lossless strip preserves JPEG compression for orientation 1', async () => {
      // Build a real orientation=1 JPEG with GPS EXIF. Assert the stored buffer
      // is byte-identical to the output of stripExifLossless applied to the input.
      const jpeg = await makeJpegBuffer({
        exif: {
          IFD0: { Make: 'TestCam' },
          IFD3: {
            GPSLatitudeRef: 'N',
            GPSLatitude: '10/1 20/1 30/1',
          },
        },
      })

      const event = createMockEvent({ session }) as any
      event.__multipartFormData = [
        makeRawFilePart('lossless.jpg', jpeg, 'image/jpeg'),
      ]

      const result = await handler(event)
      expect(result.uploaded).toBe(1)

      // Compute the expected lossless output from the input
      const actual = await vi.importActual<typeof import('~/server/utils/jpegStrip')>(
        '~/server/utils/jpegStrip',
      )
      const expected = actual.stripExifLossless(jpeg)
      expect(expected).not.toBeNull()

      const store = getStore(mockClient)
      const stored = store.get('lossless.jpg')
      expect(stored).toBeDefined()
      // Byte-identity: the compressed entropy-coded data is untouched
      expect(stored!.equals(expected!)).toBe(true)
      // Output is strictly smaller than input by exactly the EXIF segment size
      expect(stored!.length).toBeLessThan(jpeg.length)
      // Decodes cleanly with no EXIF
      const storedMeta = await sharp(stored!).metadata()
      expect(storedMeta.exif).toBeUndefined()
      // DB record still has GPS
      const photo = await Photo.findOne({ userId: userId.toString(), key: 'lossless.jpg' })
      expect((photo!.exif as any)?.GPSInfo?.GPSLatitude).toEqual([10, 20, 30])
      // Size field reflects the stripped buffer
      expect(photo!.size).toBe(stored!.length)
    })

    it('Re-encode strip path handles non-JPEG input (PNG with GPS)', async () => {
      // Build a PNG from sharp. PNG format takes the re-encode branch regardless of orientation.
      const png = await sharp({
        create: { width: 20, height: 20, channels: 3, background: { r: 0, g: 128, b: 255 } },
      })
        .png()
        .toBuffer()

      const event = createMockEvent({ session }) as any
      event.__multipartFormData = [
        makeRawFilePart('scene.png', png, 'image/png'),
      ]

      const result = await handler(event)
      expect(result.uploaded).toBe(1)

      const store = getStore(mockClient)
      const stored = store.get('scene.png')
      expect(stored).toBeDefined()
      // Stored file is a valid PNG
      const meta = await sharp(stored!).metadata()
      expect(meta.format).toBe('png')
      expect(meta.exif).toBeUndefined()
    })

    it('Lossless parser fallback on malformed JPEG falls back to re-encode', async () => {
      // Force stripExifLossless to return null, simulating a malformed JPEG
      // structure that the parser refuses but sharp can still decode.
      vi.mocked(realStripExifLossless).mockReturnValueOnce(null)

      const jpeg = await makeJpegBuffer({
        exif: {
          IFD0: { Make: 'FallbackCam' },
          IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '1/1 2/1 3/1' },
        },
      })

      const event = createMockEvent({ session }) as any
      event.__multipartFormData = [
        makeRawFilePart('fallback.jpg', jpeg, 'image/jpeg'),
      ]

      const result = await handler(event)
      expect(result.uploaded).toBe(1)

      const store = getStore(mockClient)
      const stored = store.get('fallback.jpg')
      expect(stored).toBeDefined()
      // Stored file is different from input (it was re-encoded, not passed through lossless)
      expect(stored!.equals(jpeg)).toBe(false)
      // Stored file has no EXIF
      const meta = await sharp(stored!).metadata()
      expect(meta.exif).toBeUndefined()
      // DB still has GPS (extracted from the original before stripping)
      const photo = await Photo.findOne({ userId: userId.toString(), key: 'fallback.jpg' })
      expect((photo!.exif as any)?.GPSInfo).toBeDefined()
      // Parser was invoked and returned null (fallback triggered)
      expect(vi.mocked(realStripExifLossless)).toHaveBeenCalled()
    })

    it('Re-encode strip path applies high-quality JPEG settings', async () => {
      // Force fallback path to verify the re-encode parameters don't crush quality.
      // We can't directly inspect encoder options, but we can assert the output
      // is a decodable JPEG with reasonable dimensions.
      vi.mocked(realStripExifLossless).mockReturnValueOnce(null)

      const jpeg = await makeJpegBuffer({ width: 100, height: 80 })

      const event = createMockEvent({ session }) as any
      event.__multipartFormData = [
        makeRawFilePart('reencode.jpg', jpeg, 'image/jpeg'),
      ]

      const result = await handler(event)
      expect(result.uploaded).toBe(1)

      const store = getStore(mockClient)
      const stored = store.get('reencode.jpg')
      expect(stored).toBeDefined()
      const meta = await sharp(stored!).metadata()
      expect(meta.format).toBe('jpeg')
      expect(meta.width).toBe(100)
      expect(meta.height).toBe(80)
      expect(meta.exif).toBeUndefined()
      // Photo.size reflects the stripped buffer length
      const photo = await Photo.findOne({ userId: userId.toString(), key: 'reencode.jpg' })
      expect(photo!.size).toBe(stored!.length)
    })
  })
})
