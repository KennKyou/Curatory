import { PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import exifReader from 'exif-reader'
import { Photo } from '~~/server/models/Photo'
import { getS3Client, getS3Bucket, getPublicUrl } from '~~/server/utils/s3client'
import { baseSlugFromKey, generateUniqueSlug, isImageFile, sanitizeFilename } from '~~/server/utils/photo'
import { stripExifLossless } from '~~/server/utils/jpegStrip'

interface ExtractedMetadata {
  exif: Record<string, any> | null
  takenAt: Date | null
  width: number | null
  height: number | null
  cameraName: string | null
  lensName: string | null
}

function parseExifBuffer(exifBuffer: Buffer | undefined): {
  exif: Record<string, any> | null
  takenAt: Date | null
} {
  if (!exifBuffer) return { exif: null, takenAt: null }
  try {
    const parsed = exifReader(exifBuffer)
    const { bigEndian: _be, Thumbnail: _th, ...exif } = parsed as Record<string, any>
    const dateTime = exif?.Photo?.DateTimeOriginal
    const takenAt: Date | null = dateTime instanceof Date ? dateTime : null
    return { exif, takenAt }
  } catch {
    return { exif: null, takenAt: null }
  }
}

async function reencodeStrip(buffer: Buffer, format: string | undefined): Promise<Buffer> {
  // Path B: sharp re-encode. Used for orientation != 1 JPEGs, non-JPEG formats,
  // and as a fallback when the lossless parser refuses a JPEG. rotate() MUST
  // precede the encoder so EXIF orientation is baked into pixels before the
  // EXIF tag is discarded. For JPEG outputs we use q95 mozjpeg 4:4:4 +
  // keepIccProfile to minimize fidelity loss.
  const pipeline = sharp(buffer).rotate()
  if (format === 'jpeg' || format === 'jpg') {
    return pipeline
      .jpeg({ quality: 95, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .keepIccProfile()
      .toBuffer()
  }
  // PNG is inherently lossless; sharp will strip metadata by default. Other
  // formats (WebP, GIF) use their respective sharp encoders with defaults.
  return pipeline.keepIccProfile().toBuffer()
}

async function extractAndStrip(buffer: Buffer): Promise<{ metadata: ExtractedMetadata, stripped: Buffer }> {
  const meta = await sharp(buffer).metadata()
  const { exif, takenAt } = parseExifBuffer(meta.exif)

  const make = exif?.Image?.Make != null ? String(exif.Image.Make).trim() : null
  const model = exif?.Image?.Model != null ? String(exif.Image.Model).trim() : null
  const cameraName = make || model ? [make, model].filter(Boolean).join(' ') : null
  const lensModel = exif?.Photo?.LensModel != null ? String(exif.Photo.LensModel).trim() : null
  const lensName = lensModel || null

  // EXIF orientation 5-8 means the image is rotated 90°/270° — swap dimensions.
  const swapped = meta.orientation != null && meta.orientation >= 5
  const width = swapped ? (meta.height ?? null) : (meta.width ?? null)
  const height = swapped ? (meta.width ?? null) : (meta.height ?? null)

  // Path A: lossless APP1 EXIF strip. Only applies to JPEGs whose pixels do
  // not need rotation — i.e., orientation is unset or equals 1. The lossless
  // parser removes EXIF segments without touching compressed entropy data.
  // Returns null on any structural anomaly; we fall back to Path B for safety.
  let stripped: Buffer | null = null
  const canLossless = meta.format === 'jpeg' && (meta.orientation == null || meta.orientation === 1)
  if (canLossless) {
    stripped = stripExifLossless(buffer)
  }

  // Path B: sharp re-encode (fallback, or required for rotation / non-JPEG).
  if (stripped == null) {
    stripped = await reencodeStrip(buffer, meta.format)
  }

  return {
    metadata: { exif, takenAt, width, height, cameraName, lensName },
    stripped,
  }
}

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const MAX_FILES_PER_UPLOAD = 20
const MAX_RESOLVE_ATTEMPTS = 100

async function resolveUniqueKey(client: any, bucket: string, key: string): Promise<string> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
  } catch {
    return key // Key doesn't exist, use it
  }

  // Key exists, add numeric suffix
  const lastDot = key.lastIndexOf('.')
  const base = lastDot > -1 ? key.slice(0, lastDot) : key
  const ext = lastDot > -1 ? key.slice(lastDot) : ''

  let suffix = 2
  while (suffix <= MAX_RESOLVE_ATTEMPTS + 1) {
    const candidate = `${base}-${suffix}${ext}`
    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: candidate }))
      suffix++
    } catch {
      return candidate
    }
  }
  throw createError({ statusCode: 409, message: 'Too many filename conflicts' })
}

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, message: 'No files provided' })
  }

  const files: typeof formData = []
  for (const part of formData) {
    if (part.name === 'files' && part.filename) {
      files.push(part)
    }
  }

  if (files.length === 0) {
    throw createError({ statusCode: 400, message: 'No image files provided' })
  }

  if (files.length > MAX_FILES_PER_UPLOAD) {
    throw createError({ statusCode: 400, message: 'Maximum 20 files per upload' })
  }

  const client = getS3Client()
  const bucket = getS3Bucket()
  const uploaded: { key: string; id: string }[] = []
  const errors: string[] = []

  for (const file of files) {
    let filename: string
    try {
      filename = sanitizeFilename(file.filename || '')
    } catch {
      errors.push(`${file.filename || 'unnamed'}: invalid filename`)
      continue
    }

    // Validate file type
    if (!isImageFile(filename)) {
      errors.push(`${filename}: unsupported file type`)
      continue
    }

    // Validate file size
    if (file.data.length > MAX_FILE_SIZE) {
      errors.push(`${filename}: file exceeds 20MB limit`)
      continue
    }

    // Extract EXIF (including GPSInfo) from the original buffer and produce a
    // metadata-stripped buffer to upload. rotate() MUST precede strip so that
    // EXIF orientation is baked into pixels before metadata is dropped.
    let metadata: ExtractedMetadata
    let strippedBuffer: Buffer
    try {
      const result = await extractAndStrip(file.data)
      metadata = result.metadata
      strippedBuffer = result.stripped
    } catch {
      errors.push(`${filename}: invalid or corrupt image`)
      continue
    }

    const key = await resolveUniqueKey(client, bucket, filename)

    // Upload stripped buffer to R2/S3
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: strippedBuffer,
      ContentType: file.type || 'application/octet-stream',
    }))

    // Create DB record. `exif` retains GPSInfo for the admin; public API filters it.
    const url = getPublicUrl(key)
    const slug = await generateUniqueSlug(baseSlugFromKey(key))

    const photo = await Photo.create({
      userId: session.user.id,
      key,
      url,
      thumbnailUrl: null,
      slug,
      size: strippedBuffer.length,
      lastModified: new Date(),
      takenAt: metadata.takenAt,
      exif: metadata.exif,
      width: metadata.width,
      height: metadata.height,
      cameraName: metadata.cameraName,
      lensName: metadata.lensName,
      blurDataUrl: null,
      toneAnalysis: null,
    })

    uploaded.push({ key, id: photo._id.toString() })
  }

  return {
    uploaded: uploaded.length,
    errors: errors.length > 0 ? errors : undefined,
    photos: uploaded,
    message: 'Run sync to generate thumbnails and metadata',
  }
})
