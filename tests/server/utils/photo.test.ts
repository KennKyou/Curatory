import { describe, it, expect } from 'vitest'
import { createTestPhoto } from '~/tests/helpers'
import {
  IMAGE_EXTENSIONS,
  sanitizeFilename,
  isImageFile,
  buildThumbnailKey,
  baseSlugFromKey,
  generateUniqueSlug,
  processInBatches,
} from '~/server/utils/photo'

describe('sanitizeFilename', () => {
  it('extracts basename from path', () => {
    expect(sanitizeFilename('photos/2024/sunset.jpg')).toBe('sunset.jpg')
  })

  it('returns filename as-is when no slashes', () => {
    expect(sanitizeFilename('photo.jpg')).toBe('photo.jpg')
  })

  it('throws on empty string', () => {
    expect(() => sanitizeFilename('')).toThrow('Invalid filename')
  })

  it('throws on dotfile', () => {
    expect(() => sanitizeFilename('.hidden')).toThrow('Invalid filename')
  })

  it('throws on path with double dots', () => {
    expect(() => sanitizeFilename('some/..file')).toThrow('Invalid filename')
  })
})

describe('isImageFile', () => {
  it.each(IMAGE_EXTENSIONS)('returns true for %s extension', (ext) => {
    expect(isImageFile(`photo${ext}`)).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isImageFile('photo.JPG')).toBe(true)
    expect(isImageFile('photo.Png')).toBe(true)
  })

  it('returns false for non-image files', () => {
    expect(isImageFile('document.pdf')).toBe(false)
    expect(isImageFile('video.mp4')).toBe(false)
  })
})

describe('buildThumbnailKey', () => {
  it('builds correct thumbnail path', () => {
    expect(buildThumbnailKey('photos/sunset.jpg')).toBe('.curatory/thumbnails/photos/sunset.jpg.jpg')
  })
})

describe('baseSlugFromKey', () => {
  it('extracts filename without extension', () => {
    expect(baseSlugFromKey('photos/Sunset.JPG')).toBe('sunset')
  })

  it('lowercases the result', () => {
    expect(baseSlugFromKey('MyPhoto.png')).toBe('myphoto')
  })

  it('handles nested path', () => {
    expect(baseSlugFromKey('a/b/c/file.webp')).toBe('file')
  })
})

describe('generateUniqueSlug', () => {
  it('returns base slug when no conflict', async () => {
    const slug = await generateUniqueSlug('unique-slug')
    expect(slug).toBe('unique-slug')
  })

  it('appends suffix when slug already exists', async () => {
    await createTestPhoto({ slug: 'my-photo' })
    const slug = await generateUniqueSlug('my-photo')
    expect(slug).toBe('my-photo-2')
  })

  it('increments suffix until unique', async () => {
    await createTestPhoto({ slug: 'dup' })
    await createTestPhoto({ slug: 'dup-2' })
    await createTestPhoto({ slug: 'dup-3' })
    const slug = await generateUniqueSlug('dup')
    expect(slug).toBe('dup-4')
  })
})

describe('processInBatches', () => {
  it('processes all items', async () => {
    const items = [1, 2, 3, 4, 5]
    const results = await processInBatches(items, 2, async (n) => n * 10)
    expect(results).toEqual([10, 20, 30, 40, 50])
  })

  it('respects concurrency limit', async () => {
    let maxConcurrent = 0
    let running = 0

    await processInBatches([1, 2, 3, 4], 2, async () => {
      running++
      maxConcurrent = Math.max(maxConcurrent, running)
      await new Promise(r => setTimeout(r, 10))
      running--
    })

    expect(maxConcurrent).toBeLessThanOrEqual(2)
  })

  it('handles empty array', async () => {
    const results = await processInBatches([], 3, async (n) => n)
    expect(results).toEqual([])
  })

  it('passes correct index to callback', async () => {
    const indices: number[] = []
    await processInBatches(['a', 'b', 'c'], 2, async (_, idx) => {
      indices.push(idx)
    })
    expect(indices).toEqual([0, 1, 2])
  })
})
