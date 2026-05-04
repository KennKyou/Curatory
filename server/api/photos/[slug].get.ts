import { Photo, ZERO_REACTION_COUNTS } from '~~/server/models/Photo'
import { SiteSettings } from '~~/server/models/SiteSettings'
import { stripGpsFromExif } from '~~/server/utils/exifPrivacy'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, message: 'Slug is required' })
  }

  const photo = await Photo.findOne({ slug }).lean()
  if (!photo) {
    throw createError({ statusCode: 404, message: 'Photo not found' })
  }

  const settings = await SiteSettings.findOne({ userId: photo.userId }).lean()
  const shouldStripGps = settings?.showGpsInfo !== true
  const rawExif = photo.exif ?? null
  const exif = shouldStripGps ? stripGpsFromExif(rawExif) : rawExif

  return {
    id: photo._id,
    url: photo.url,
    thumbnailUrl: photo.thumbnailUrl,
    key: photo.key,
    slug: photo.slug,
    size: photo.size,
    width: photo.width ?? null,
    height: photo.height ?? null,
    exif,
    takenAt: photo.takenAt ?? null,
    toneAnalysis: photo.toneAnalysis ?? null,
    reactionCounts: photo.reactionCounts ?? { ...ZERO_REACTION_COUNTS },
    topReaction: photo.topReaction ?? null,
    reactionTotal: photo.reactionTotal ?? 0,
  }
})
