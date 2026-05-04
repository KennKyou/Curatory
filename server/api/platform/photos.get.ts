import mongoose from 'mongoose'
import { Photo } from '~~/server/models/Photo'
import type { PlatformPhotosResponse } from '~~/server/types/api'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  const query = getQuery(event)
  const lastId = typeof query.lastId === 'string' ? query.lastId : ''
  const idsQuery = Array.isArray(query.ids) ? query.ids.join(',') : typeof query.ids === 'string' ? query.ids : ''
  const limit = 50

  const filter: Record<string, any> = { userId: session.user.id }

  if (idsQuery) {
    const ids = idsQuery
      .split(',')
      .map(id => id.trim())
      .filter(id => mongoose.Types.ObjectId.isValid(id))

    if (ids.length === 0) {
      return { photos: [], hasMore: false, lastId: null } satisfies PlatformPhotosResponse
    }

    const photos = await Photo.find({
      ...filter,
      _id: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) },
    })
      .select('key url thumbnailUrl slug size width height blurDataUrl takenAt')
      .lean()

    return {
      photos: photos.map(p => ({
        id: p._id.toString(),
        key: p.key,
        url: p.url,
        thumbnailUrl: p.thumbnailUrl,
        slug: p.slug,
        size: p.size,
        width: p.width,
        height: p.height,
        blurDataUrl: p.blurDataUrl,
      })),
      hasMore: false,
      lastId: null,
    } satisfies PlatformPhotosResponse
  }

  // Cursor-based pagination: fetch the cursor document to get its sort values
  if (lastId && mongoose.Types.ObjectId.isValid(lastId)) {
    const cursor = await Photo.findById(lastId, { takenAt: 1 }).lean()
    if (cursor) {
      filter.$or = [
        { takenAt: { $lt: cursor.takenAt } },
        { takenAt: cursor.takenAt, _id: { $lt: new mongoose.Types.ObjectId(lastId) } },
      ]
    }
  }

  const photos = await Photo.find(filter)
    .sort({ takenAt: -1, _id: -1 })
    .limit(limit + 1)
    .select('key url thumbnailUrl slug size width height blurDataUrl takenAt')
    .lean()

  const hasMore = photos.length > limit
  const items = hasMore ? photos.slice(0, limit) : photos

  return {
    photos: items.map(p => ({
      id: p._id.toString(),
      key: p.key,
      url: p.url,
      thumbnailUrl: p.thumbnailUrl,
      slug: p.slug,
      size: p.size,
      width: p.width,
      height: p.height,
      blurDataUrl: p.blurDataUrl,
    })),
    hasMore,
    lastId: items.length > 0 ? items[items.length - 1]!._id.toString() : null,
  } satisfies PlatformPhotosResponse
})
