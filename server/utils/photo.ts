import { Photo } from '~~/server/models/Photo'

export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']

export function sanitizeFilename(raw: string): string {
  const basename = raw.split('/').pop() || ''
  if (!basename || basename.startsWith('.') || basename.includes('..')) {
    throw createError({ statusCode: 400, message: 'Invalid filename' })
  }
  return basename
}

export function isImageFile(key: string): boolean {
  const lower = key.toLowerCase()
  return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext))
}

export function buildThumbnailKey(originalKey: string): string {
  return `.curatory/thumbnails/${originalKey}.jpg`
}

export function baseSlugFromKey(key: string): string {
  const filename = key.split('/').pop() || key
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '')
  return nameWithoutExt.toLowerCase()
}

const MAX_SLUG_ATTEMPTS = 100

export async function generateUniqueSlug(baseSlug: string): Promise<string> {
  const existing = await Photo.findOne({ slug: baseSlug })
  if (!existing) return baseSlug

  let suffix = 2
  while (suffix <= MAX_SLUG_ATTEMPTS + 1) {
    const candidate = `${baseSlug}-${suffix}`
    const found = await Photo.findOne({ slug: candidate })
    if (!found) return candidate
    suffix++
  }
  throw createError({ statusCode: 500, message: 'Failed to generate unique slug' })
}

export async function processInBatches<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map((item, batchIndex) => fn(item, i + batchIndex)),
    )
    results.push(...batchResults)
  }
  return results
}
