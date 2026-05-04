import satori from 'satori'
import sharp from 'sharp'
import { Photo } from '~~/server/models/Photo'
import { SiteSettings } from '~~/server/models/SiteSettings'

const WIDTH = 1200
const HEIGHT = 630

// Module-level font cache
let fontBuffer: Buffer | null = null
async function getFont(): Promise<Buffer> {
  if (!fontBuffer) {
    const storage = useStorage('assets:server')
    const data = await storage.getItemRaw('fonts:UoqMunThenKhung-Regular.ttf')
    if (!data) throw new Error('Font file not found in storage')
    fontBuffer = Buffer.from(data as ArrayBuffer)
  }
  return fontBuffer
}

function formatShutter(exposure: number | undefined): string | null {
  if (exposure == null) return null
  if (exposure >= 1) return `${exposure}s`
  return `1/${Math.round(1 / exposure)}`
}

function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    const yyyy = d.getUTCFullYear()
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    return `${yyyy}/${mm}/${dd}`
  } catch {
    return null
  }
}

async function fetchImageAsDataUri(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  return `data:${contentType};base64,${buffer.toString('base64')}`
}

export function getPhotoOgBrandName(settings: { siteName?: string | null, exhibition?: { title?: string | null } } | null | undefined): string {
  const siteName = settings?.siteName?.trim() || ''
  return settings?.exhibition?.title?.trim() || siteName || 'Curatory'
}

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, message: 'Slug is required' })
  }

  const [photo, settings] = await Promise.all([
    Photo.findOne({ slug }).lean(),
    SiteSettings.findOne().lean(),
  ])

  if (!photo) {
    throw createError({ statusCode: 404, message: 'Photo not found' })
  }

  const brandName = getPhotoOgBrandName(settings)
  const filename = photo.key.split('/').pop() || photo.key
  const imageUrl = photo.thumbnailUrl || photo.url

  // SSRF protection: only fetch from configured S3 origin
  const s3PublicUrl = useRuntimeConfig().s3PublicUrl
  if (s3PublicUrl && !imageUrl.startsWith(s3PublicUrl)) {
    throw createError({ statusCode: 403, message: 'Image URL not allowed' })
  }

  // Fetch thumbnail and convert to data URI
  let imageDataUri: string
  try {
    imageDataUri = await fetchImageAsDataUri(imageUrl)
  } catch {
    throw createError({ statusCode: 500, message: 'Failed to fetch photo image' })
  }

  // Extract EXIF info
  const exif = photo.exif as Record<string, any> | null
  const imageExif = exif?.Image
  const photoExif = exif?.Photo

  const make = imageExif?.Make
  const model = imageExif?.Model
  const camera = [make, model].filter(Boolean).join(' ') || null

  const lens = photoExif?.LensModel || null

  const parts: string[] = []
  if (photoExif?.FNumber != null) parts.push(`ƒ/${photoExif.FNumber}`)
  const shutter = formatShutter(photoExif?.ExposureTime)
  if (shutter) parts.push(shutter)
  const iso = photoExif?.ISOSpeedRatings
  if (iso != null) {
    const isoVal = Array.isArray(iso) ? iso[0] : iso
    parts.push(`ISO ${isoVal}`)
  }
  const exposureLine = parts.length > 0 ? parts.join('  ·  ') : null

  const dateLine = formatDate(photo.takenAt as string | null)

  // Build info lines (only non-null)
  const infoLines: { text: string; fontSize: number; color: string }[] = []
  infoLines.push({ text: filename, fontSize: 28, color: '#FFFFFF' })
  if (camera) infoLines.push({ text: camera, fontSize: 22, color: '#CCCCCC' })
  if (lens) infoLines.push({ text: lens, fontSize: 22, color: '#CCCCCC' })
  if (exposureLine) infoLines.push({ text: exposureLine, fontSize: 22, color: '#CCCCCC' })
  if (dateLine) infoLines.push({ text: dateLine, fontSize: 20, color: '#999999' })

  // Build Satori markup
  const markup = {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1a1a1a',
        padding: '48px',
        fontFamily: 'UoqMunThenKhung',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flex: 1,
              gap: '48px',
              alignItems: 'center',
            },
            children: [
              // Photo thumbnail
              {
                type: 'img',
                props: {
                  src: imageDataUri,
                  style: {
                    width: '500px',
                    height: '480px',
                    objectFit: 'contain',
                    flexShrink: 0,
                  },
                },
              },
              // Info section
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '12px',
                    flex: 1,
                  },
                  children: infoLines.map(line => ({
                    type: 'div',
                    props: {
                      style: {
                        fontSize: `${line.fontSize}px`,
                        color: line.color,
                        lineHeight: 1.4,
                      },
                      children: line.text,
                    },
                  })),
                },
              },
            ],
          },
        },
        // Branding
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              paddingTop: '16px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '18px',
                    color: '#666666',
                    letterSpacing: '1px',
                  },
                  children: brandName,
                },
              },
            ],
          },
        },
      ],
    },
  }

  const font = await getFont()

  const svg = await satori(markup as any, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      {
        name: 'UoqMunThenKhung',
        data: font,
        weight: 400,
        style: 'normal',
      },
    ],
  })

  const png = await sharp(Buffer.from(svg))
    .resize(WIDTH, HEIGHT)
    .png()
    .toBuffer()

  setResponseHeader(event, 'Content-Type', 'image/png')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=86400')
  return png
})
