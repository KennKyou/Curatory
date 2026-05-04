import { Types } from 'mongoose'
import { Photo, ZERO_REACTION_COUNTS } from '~~/server/models/Photo'
import { SiteSettings } from '~~/server/models/SiteSettings'
import { stripGpsFromExif } from '~~/server/utils/exifPrivacy'
import { getPublicOwnerUser } from '~~/server/utils/publicOwner'

const MAX_PUBLIC_PHOTO_PAGE = 100

function parsePage(value: unknown): number {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return 1
  return Number(value)
}

export default defineEventHandler(async (event) => {
  const user = await getPublicOwnerUser()
  if (!user) {
    throw createError({ statusCode: 404, message: 'Exhibition not configured' })
  }

  const query = getQuery(event)
  const page = parsePage(query.page)
  if (page > MAX_PUBLIC_PHOTO_PAGE) {
    throw createError({ statusCode: 400, message: 'Page is too high' })
  }
  const limit = 30

  const filter: Record<string, any> = { userId: user._id }

  const [pagePhotos, total, settings] = await Promise.all([
    Photo.find(filter)
      .sort({ takenAt: -1, lastModified: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Photo.countDocuments(filter),
    SiteSettings.findOne({ userId: user._id }).lean(),
  ])

  const exhibition = settings?.exhibition
  const exhibitionSelectionIds = [...new Set([
    exhibition?.coverPhotoId,
    ...((exhibition?.sections ?? []).flatMap(section => section.photoIds ?? [])),
  ].filter(Boolean).map(id => id!.toString()))]
  const includeExhibitionSelections = page === 1
    && exhibitionSelectionIds.length > 0
  let exhibitionCoverPhoto: typeof pagePhotos[number] | null = null
  let exhibitionSections: Array<{ id: string; photos: typeof pagePhotos }> = []

  if (includeExhibitionSelections) {
    const selectedPhotos = await Photo.find({
      userId: user._id,
      _id: { $in: exhibitionSelectionIds.map(id => new Types.ObjectId(id)) },
    }).lean()
    const selectedById = new Map(selectedPhotos.map(photo => [photo._id.toString(), photo]))
    const coverId = exhibition?.coverPhotoId?.toString()
    exhibitionCoverPhoto = coverId ? selectedById.get(coverId) ?? null : null
    exhibitionSections = (exhibition?.sections ?? []).map(section => ({
      id: section.id,
      photos: (section.photoIds ?? [])
        .map(id => selectedById.get(id.toString()))
        .filter((photo): photo is typeof selectedPhotos[number] => Boolean(photo)),
    }))
  }

  const mapPhoto = (p: typeof pagePhotos[number]) => ({
    id: p._id,
    url: p.url,
    thumbnailUrl: p.thumbnailUrl,
    key: p.key,
    slug: p.slug,
    size: p.size,
    lastModified: p.lastModified,
    width: p.width ?? null,
    height: p.height ?? null,
    blurDataUrl: p.blurDataUrl ?? null,
    exif: stripGpsFromExif(p.exif ?? null),
    takenAt: p.takenAt ?? null,
    toneAnalysis: p.toneAnalysis ?? null,
    reactionCounts: p.reactionCounts ?? { ...ZERO_REACTION_COUNTS },
    topReaction: p.topReaction ?? null,
    reactionTotal: p.reactionTotal ?? 0,
  })

  return {
    photos: pagePhotos.map(mapPhoto),
    exhibitionSelection: {
      coverPhoto: exhibitionCoverPhoto ? mapPhoto(exhibitionCoverPhoto) : null,
      sections: exhibitionSections.map(section => ({
        id: section.id,
        photos: section.photos.map(mapPhoto),
      })),
    },
    pagination: {
      page,
      limit,
      total,
      hasMore: page * limit < total,
    },
    user: {
      name: user.name,
      avatar: user.avatar,
    },
  }
})
