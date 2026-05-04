import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { Readable } from 'node:stream'

// Mock S3 client — intercept GetObject and PutObject
function createMockS3Client(imageBuffer: Buffer) {
  return {
    send: vi.fn().mockImplementation((command: any) => {
      const commandName = command.constructor?.name || command.__commandName
      if (commandName === 'GetObjectCommand' || command.input?.Key) {
        // GetObject — return image as stream
        if (command.input?.Body !== undefined || (!command.input?.CopySource)) {
          // Distinguish Get vs Put by checking if it's likely a Get
          if (!command.input?.Body && !command.input?.ContentType) {
            return Promise.resolve({
              Body: Readable.from(imageBuffer),
              ContentLength: imageBuffer.length,
            })
          }
        }
        // PutObject — just resolve
        return Promise.resolve({})
      }
      return Promise.resolve({
        Body: Readable.from(imageBuffer),
        ContentLength: imageBuffer.length,
      })
    }),
  }
}

// Better approach: mock by command constructor name
function createS3Mock(imageBuffer: Buffer) {
  let callCount = 0
  return {
    send: vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // First call = GetObject
        return Promise.resolve({
          Body: Readable.from(imageBuffer),
          ContentLength: imageBuffer.length,
        })
      }
      // Second call = PutObject
      return Promise.resolve({})
    }),
  }
}

describe('generateThumbnail', () => {
  describe('parseExif (indirect)', () => {
    it('handles image without EXIF data gracefully', async () => {
      // Create a simple image with no EXIF
      const buffer = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 128, g: 128, b: 128 } },
      }).jpeg().toBuffer()

      const s3 = createS3Mock(buffer)
      const { generateThumbnail } = await import('~/server/utils/thumbnail')

      const result = await generateThumbnail(
        s3 as any,
        'test-bucket',
        'photos/test.jpg',
        '.curatory/thumbnails/photos/test.jpg.jpg',
      )

      expect(result.takenAt).toBeNull()
      expect(result.cameraName).toBeNull()
      expect(result.lensName).toBeNull()
    })

    it('handles corrupt/invalid image EXIF gracefully', async () => {
      // Create a valid JPEG — sharp-generated images have no EXIF by default
      // so this effectively tests the "no exif buffer" path
      const buffer = await sharp({
        create: { width: 50, height: 50, channels: 3, background: { r: 100, g: 100, b: 100 } },
      }).jpeg().toBuffer()

      const s3 = createS3Mock(buffer)
      const { generateThumbnail } = await import('~/server/utils/thumbnail')

      const result = await generateThumbnail(
        s3 as any,
        'test-bucket',
        'photos/no-exif.jpg',
        '.curatory/thumbnails/photos/no-exif.jpg.jpg',
      )

      expect(result.exif).toBeNull()
      expect(result.takenAt).toBeNull()
    })
  })

  describe('analyzeTone (indirect)', () => {
    it('classifies dark image as Low Key', async () => {
      const buffer = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 20, g: 20, b: 20 } },
      }).jpeg().toBuffer()

      const s3 = createS3Mock(buffer)
      const { generateThumbnail } = await import('~/server/utils/thumbnail')

      const result = await generateThumbnail(
        s3 as any,
        'test-bucket',
        'photos/dark.jpg',
        '.curatory/thumbnails/photos/dark.jpg.jpg',
      )

      expect(result.toneAnalysis).not.toBeNull()
      expect(result.toneAnalysis!.toneType).toBe('Low Key')
      expect(result.toneAnalysis!.brightness).toBeLessThan(35)
    })

    it('classifies bright image as High Key', async () => {
      const buffer = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 240, g: 240, b: 240 } },
      }).jpeg().toBuffer()

      const s3 = createS3Mock(buffer)
      const { generateThumbnail } = await import('~/server/utils/thumbnail')

      const result = await generateThumbnail(
        s3 as any,
        'test-bucket',
        'photos/bright.jpg',
        '.curatory/thumbnails/photos/bright.jpg.jpg',
      )

      expect(result.toneAnalysis).not.toBeNull()
      expect(result.toneAnalysis!.toneType).toBe('High Key')
      expect(result.toneAnalysis!.brightness).toBeGreaterThan(65)
    })

    it('classifies mid-tone image as Normal', async () => {
      const buffer = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 128, g: 128, b: 128 } },
      }).jpeg().toBuffer()

      const s3 = createS3Mock(buffer)
      const { generateThumbnail } = await import('~/server/utils/thumbnail')

      const result = await generateThumbnail(
        s3 as any,
        'test-bucket',
        'photos/mid.jpg',
        '.curatory/thumbnails/photos/mid.jpg.jpg',
      )

      expect(result.toneAnalysis).not.toBeNull()
      expect(result.toneAnalysis!.toneType).toBe('Normal')
      expect(result.toneAnalysis!.brightness).toBeGreaterThanOrEqual(35)
      expect(result.toneAnalysis!.brightness).toBeLessThanOrEqual(65)
    })
  })

  describe('image dimensions', () => {
    it('returns correct width and height', async () => {
      const buffer = await sharp({
        create: { width: 200, height: 150, channels: 3, background: { r: 100, g: 100, b: 100 } },
      }).jpeg().toBuffer()

      const s3 = createS3Mock(buffer)
      const { generateThumbnail } = await import('~/server/utils/thumbnail')

      const result = await generateThumbnail(
        s3 as any,
        'test-bucket',
        'photos/sized.jpg',
        '.curatory/thumbnails/photos/sized.jpg.jpg',
      )

      expect(result.width).toBe(200)
      expect(result.height).toBe(150)
    })
  })

  describe('blurDataUrl', () => {
    it('generates LQIP data URL', async () => {
      const buffer = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 100, g: 150, b: 200 } },
      }).jpeg().toBuffer()

      const s3 = createS3Mock(buffer)
      const { generateThumbnail } = await import('~/server/utils/thumbnail')

      const result = await generateThumbnail(
        s3 as any,
        'test-bucket',
        'photos/blur.jpg',
        '.curatory/thumbnails/photos/blur.jpg.jpg',
      )

      expect(result.blurDataUrl).not.toBeNull()
      expect(result.blurDataUrl).toMatch(/^data:image\/jpeg;base64,/)
    })
  })
})
