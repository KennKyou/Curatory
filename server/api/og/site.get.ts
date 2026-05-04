import satori from 'satori'
import sharp from 'sharp'
import { Photo } from '~~/server/models/Photo'
import { SiteSettings } from '~~/server/models/SiteSettings'
import { getPublicOwnerUser } from '~~/server/utils/publicOwner'

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

async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    return `data:${contentType};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const [settings, ownerUser, recentPhotos] = await Promise.all([
    SiteSettings.findOne().lean(),
    getPublicOwnerUser(),
    Photo.find({})
      .sort({ takenAt: -1, lastModified: -1 })
      .limit(6)
      .select('thumbnailUrl url')
      .lean(),
  ])

  const siteName = settings?.siteName || 'Curatory'
  const siteDescription = settings?.siteDescription || ''
  const avatarUrl = ownerUser?.avatar || ''

  // SSRF protection: only fetch from the configured S3/R2 public origin.
  const s3PublicUrl = config.s3PublicUrl
  const allowedOrigins = [s3PublicUrl].filter(Boolean)
  function isAllowedUrl(url: string): boolean {
    return allowedOrigins.some(origin => url.startsWith(origin))
  }

  // Fetch avatar and background photos in parallel
  const imageUrls = recentPhotos.map(p => p.thumbnailUrl || p.url)
  const [avatarDataUri, ...photoDataUris] = await Promise.all([
    avatarUrl && isAllowedUrl(avatarUrl) ? fetchImageAsDataUri(avatarUrl) : Promise.resolve(null),
    ...imageUrls.filter(url => isAllowedUrl(url)).map(url => fetchImageAsDataUri(url)),
  ])

  // Build background photo grid (3 columns x 2 rows)
  // Each cell: 400 x 315
  const bgPhotos: any[] = photoDataUris
    .filter((uri): uri is string => uri !== null)
    .map(uri => ({
      type: 'img',
      props: {
        src: uri,
        style: {
          width: '400px',
          height: '315px',
          objectFit: 'cover',
        },
      },
    }))

  // Build markup with layered structure
  const layers: any[] = []

  // Layer 1: Photo grid background
  if (bgPhotos.length > 0) {
    layers.push({
      type: 'div',
      props: {
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexWrap: 'wrap',
        },
        children: bgPhotos,
      },
    })

    // Layer 2: Dark overlay
    layers.push({
      type: 'div',
      props: {
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
        },
      },
    })
  }

  // Layer 3: Content
  const contentChildren: any[] = []

  // Avatar + Site name row
  const headerChildren: any[] = []
  if (avatarDataUri) {
    headerChildren.push({
      type: 'img',
      props: {
        src: avatarDataUri,
        style: {
          width: '100px',
          height: '100px',
          borderRadius: '4px',
          objectFit: 'cover',
          flexShrink: 0,
        },
      },
    })
  }

  headerChildren.push({
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              fontSize: '40px',
              color: '#FFFFFF',
              lineHeight: 1.2,
            },
            children: siteName,
          },
        },
        ...(siteDescription
          ? [{
              type: 'div',
              props: {
                style: {
                  fontSize: '20px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  lineHeight: 1.4,
                },
                children: siteDescription,
              },
            }]
          : []),
      ],
    },
  })

  contentChildren.push({
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '28px',
      },
      children: headerChildren,
    },
  })

  layers.push({
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '64px',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              justifyContent: 'center',
            },
            children: contentChildren,
          },
        },
        // Branding footer
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '18px',
                    color: 'rgba(255, 255, 255, 0.4)',
                    letterSpacing: '1px',
                  },
                  children: 'Curatory',
                },
              },
            ],
          },
        },
      ],
    },
  })

  const markup = {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        backgroundColor: '#1a1a1a',
        fontFamily: 'UoqMunThenKhung',
      },
      children: layers,
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
