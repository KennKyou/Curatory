import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { Photo } from '~~/server/models/Photo'
import { getS3Client, getS3Bucket } from '~~/server/utils/s3client'
import { buildThumbnailKey, processInBatches } from '~~/server/utils/photo'

const CONCURRENCY = 5

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  const body = await readBody(event)
  const ids = Array.isArray(body.ids) ? body.ids : []

  if (ids.length === 0) {
    throw createError({ statusCode: 400, message: 'No photo IDs provided' })
  }

  const photos = await Photo.find({ _id: { $in: ids }, userId: session.user.id })

  if (photos.length === 0) {
    throw createError({ statusCode: 404, message: 'No matching photos found' })
  }

  const client = getS3Client()
  const bucket = getS3Bucket()

  // Delete R2/S3 objects (original + thumbnail)
  await processInBatches(photos, CONCURRENCY, async (photo) => {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: photo.key }))
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: buildThumbnailKey(photo.key) }))
    } catch {
      // Thumbnail may not exist
    }
  })

  // Delete DB records
  await Photo.deleteMany({ _id: { $in: photos.map(p => p._id) } })

  return { deleted: photos.length }
})
