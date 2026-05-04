import { GetObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import exifReader from 'exif-reader'
import type { Readable } from 'node:stream'

const MAX_WIDTH = 800
const JPEG_QUALITY = 80

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

interface ToneAnalysis {
  toneType: string
  brightness: number
  contrast: number
  shadowRatio: number
  highlightRatio: number
  histogram: number[]
}

async function analyzeTone(buffer: Buffer): Promise<ToneAnalysis> {
  const stats = await sharp(buffer, { failOn: 'none' }).stats()

  // Brightness: average of RGB channel means, normalized to 0-100
  const brightness = Math.round(
    ((stats.channels[0]!.mean + stats.channels[1]!.mean + stats.channels[2]!.mean) / 3 / 255) * 100,
  )

  // Contrast: average of RGB channel stdevs, normalized to 0-100
  const contrast = Math.round(
    ((stats.channels[0]!.stdev + stats.channels[1]!.stdev + stats.channels[2]!.stdev) / 3 / 128) * 100,
  )

  // Compute histogram from resized image for performance
  const { data, info } = await sharp(buffer, { failOn: 'none' })
    .resize(800, undefined, { withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const histogram = new Array(256).fill(0)
  const totalPixels = info.width * info.height
  let shadowCount = 0
  let highlightCount = 0

  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!
    const luminance = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    histogram[luminance]!++
    if (luminance < 64) shadowCount++
    if (luminance > 192) highlightCount++
  }

  const shadowRatio = Math.round((shadowCount / totalPixels) * 100)
  const highlightRatio = Math.round((highlightCount / totalPixels) * 100)

  let toneType = 'Normal'
  if (brightness < 35) toneType = 'Low Key'
  else if (brightness > 65) toneType = 'High Key'

  return { toneType, brightness, contrast, shadowRatio, highlightRatio, histogram }
}

function parseExif(exifBuffer: Buffer | undefined): { takenAt: Date | null, exif: Record<string, any> | null } {
  if (!exifBuffer) return { takenAt: null, exif: null }
  try {
    const parsed = exifReader(exifBuffer)
    const { bigEndian, Thumbnail, ...exif } = parsed
    const dateTime = exif?.Photo?.DateTimeOriginal
    const takenAt: Date | null = dateTime instanceof Date ? dateTime : null
    return { takenAt, exif }
  } catch {
    return { takenAt: null, exif: null }
  }
}

export async function generateThumbnail(
  client: S3Client,
  bucket: string,
  originalKey: string,
  thumbnailKey: string,
): Promise<{ takenAt: Date | null, exif: Record<string, any> | null, toneAnalysis: ToneAnalysis | null, width: number | null, height: number | null, blurDataUrl: string | null, cameraName: string | null, lensName: string | null }> {
  // Download original image
  const getResponse = await client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: originalKey,
  }))

  if (!getResponse.Body) {
    throw new Error(`Empty response body for ${originalKey}`)
  }

  const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
  if (getResponse.ContentLength && getResponse.ContentLength > MAX_FILE_SIZE) {
    throw new Error(`File too large (${Math.round(getResponse.ContentLength / 1024 / 1024)}MB): ${originalKey}`)
  }

  const originalBuffer = await streamToBuffer(getResponse.Body as Readable)

  // Extract EXIF metadata
  const metadata = await sharp(originalBuffer, { failOn: 'none' }).metadata()
  const { takenAt, exif } = parseExif(metadata.exif)

  // Extract cameraName and lensName from EXIF
  const make = exif?.Image?.Make != null ? String(exif.Image.Make).trim() : null
  const model = exif?.Image?.Model != null ? String(exif.Image.Model).trim() : null
  const cameraName = make || model ? [make, model].filter(Boolean).join(' ') : null
  const lensModel = exif?.Photo?.LensModel != null ? String(exif.Photo.LensModel).trim() : null
  const lensName = lensModel || null

  // Compute tone analysis
  let toneAnalysis: ToneAnalysis | null = null
  try {
    toneAnalysis = await analyzeTone(originalBuffer)
  } catch {
    // Tone analysis failure is non-fatal
  }

  // Generate thumbnail
  const thumbnailBuffer = await sharp(originalBuffer, { failOn: 'none' })
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer()

  // Upload thumbnail
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: thumbnailKey,
    Body: thumbnailBuffer,
    ContentType: 'image/jpeg',
  }))

  // EXIF orientation 5-8 means the image is rotated 90°/270°, so width and height are swapped
  const swapped = metadata.orientation != null && metadata.orientation >= 5
  const width = swapped ? (metadata.height ?? null) : (metadata.width ?? null)
  const height = swapped ? (metadata.width ?? null) : (metadata.height ?? null)

  // Generate LQIP (Low-Quality Image Placeholder)
  let blurDataUrl: string | null = null
  try {
    const lqipBuffer = await sharp(originalBuffer, { failOn: 'none' })
      .rotate()
      .resize({ width: 20 })
      .jpeg({ quality: 50 })
      .toBuffer()
    blurDataUrl = `data:image/jpeg;base64,${lqipBuffer.toString('base64')}`
  } catch {
    // LQIP generation failure is non-fatal
  }

  return { takenAt, exif, toneAnalysis, width, height, blurDataUrl, cameraName, lensName }
}
