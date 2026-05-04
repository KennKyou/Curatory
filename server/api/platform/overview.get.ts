import mongoose from 'mongoose'
import { Photo } from '~~/server/models/Photo'
import type { PlatformOverviewResponse } from '~~/server/types/api'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  const userId = new mongoose.Types.ObjectId(session.user.id)

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [totalPhotos, uploadsThisMonth, storageAgg, recentPhotos] = await Promise.all([
    Photo.countDocuments({ userId }),
    Photo.countDocuments({ userId, createdAt: { $gte: monthStart } }),
    Photo.aggregate([
      { $match: { userId } },
      { $group: { _id: null, totalSize: { $sum: '$size' } } },
    ]),
    Photo.find({ userId })
      .sort({ createdAt: -1 })
      .limit(8)
      .select('key slug thumbnailUrl size takenAt createdAt')
      .lean(),
  ])

  const storageUsed = storageAgg[0]?.totalSize ?? 0
  const averagePhotoSize = totalPhotos > 0 ? Math.round(storageUsed / totalPhotos) : 0

  const recentActivity = recentPhotos.map(p => {
    const filename = p.key.split('/').pop() || p.key
    const name = filename.replace(/\.[^.]+$/, '')
    return {
      type: 'upload' as const,
      name,
      key: p.key,
      slug: p.slug,
      thumbnailUrl: p.thumbnailUrl,
      size: p.size,
      takenAt: p.takenAt ? p.takenAt.toISOString() : null,
      timestamp: p.createdAt.toISOString(),
    }
  })

  return {
    totalPhotos,
    storageUsed,
    averagePhotoSize,
    uploadsThisMonth,
    syncCompletion: 100,
    pending: 0,
    conflicts: 0,
    recentActivity,
  } satisfies PlatformOverviewResponse
})
