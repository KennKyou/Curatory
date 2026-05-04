import { ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { Photo } from '~~/server/models/Photo'
import { User } from '~~/server/models/User'
import { getS3Client, getS3Bucket, getPublicUrl } from '~~/server/utils/s3client'
import { generateThumbnail } from '~~/server/utils/thumbnail'
import { isImageFile, buildThumbnailKey, baseSlugFromKey, generateUniqueSlug } from '~~/server/utils/photo'

let scanInProgress = false

export default defineEventHandler(async (event) => {
  if (scanInProgress) {
    throw createError({ statusCode: 409, message: 'Scan already in progress' })
  }

  const session = await requireUserSession(event)

  const user = await User.findById(session.user.id)
  if (!user) {
    throw createError({ statusCode: 401, message: 'User not found' })
  }

  scanInProgress = true

  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'Connection', 'keep-alive')

  const send = (data: Record<string, any>) => {
    event.node.res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  try {
    const client = getS3Client()
    const bucket = getS3Bucket()

    // Phase: listing
    send({ phase: 'listing', message: 'Listing objects...' })

    const s3Objects: { key: string; size: number; lastModified: Date }[] = []
    let continuationToken: string | undefined

    do {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      })
      const response = await client.send(command)

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (!obj.Key || obj.Key.startsWith('.curatory/')) continue
          if (!isImageFile(obj.Key)) continue

          s3Objects.push({
            key: obj.Key,
            size: obj.Size || 0,
            lastModified: obj.LastModified || new Date(),
          })
        }
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
    } while (continuationToken)

    // Compare with existing DB records
    const existingPhotos = await Photo.find({ userId: session.user.id })
    const existingKeys = new Set(existingPhotos.map(p => p.key))
    const s3Keys = new Set(s3Objects.map(o => o.key))

    const newObjects = s3Objects.filter(o => !existingKeys.has(o.key))
    const removedPhotos = existingPhotos.filter(p => !s3Keys.has(p.key))

    // Combine new photos + existing photos missing metadata for thumbnail processing
    const unchangedPhotos = existingPhotos.filter(p => s3Keys.has(p.key))
    const needsMetadata = unchangedPhotos.filter(p => !p.thumbnailUrl)
    const totalToProcess = newObjects.length + needsMetadata.length

    let thumbnailsGenerated = 0
    let thumbnailsFailed = 0
    let current = 0

    // Phase: thumbnail — process new photos
    const newPhotoRecords: any[] = []

    for (const obj of newObjects) {
      current++
      send({ phase: 'thumbnail', current, total: totalToProcess, key: obj.key })

      const url = getPublicUrl(obj.key)
      let thumbnailUrl: string | null = null
      let takenAt: Date | null = null
      let exif: Record<string, any> | null = null
      let toneAnalysis: Record<string, any> | null = null
      let width: number | null = null
      let height: number | null = null
      let blurDataUrl: string | null = null
      let cameraName: string | null = null
      let lensName: string | null = null

      try {
        const thumbnailKey = buildThumbnailKey(obj.key)
        const result = await generateThumbnail(client, bucket, obj.key, thumbnailKey)
        thumbnailUrl = getPublicUrl(thumbnailKey)
        takenAt = result.takenAt
        exif = result.exif
        toneAnalysis = result.toneAnalysis
        width = result.width
        height = result.height
        blurDataUrl = result.blurDataUrl
        cameraName = result.cameraName
        lensName = result.lensName
        thumbnailsGenerated++
      } catch (err: any) {
        send({ phase: 'thumbnail-error', current, total: totalToProcess, key: obj.key, error: err.message || 'Unknown error' })
        thumbnailsFailed++
      }

      const slug = await generateUniqueSlug(baseSlugFromKey(obj.key))

      newPhotoRecords.push({
        userId: session.user.id,
        key: obj.key,
        url,
        thumbnailUrl,
        slug,
        takenAt,
        exif,
        toneAnalysis,
        width,
        height,
        blurDataUrl,
        cameraName,
        lensName,
        size: obj.size,
        lastModified: obj.lastModified,
      })
    }

    const bulkOps: any[] = newPhotoRecords.map(doc => ({ insertOne: { document: doc } }))

    // Phase: thumbnail — process existing photos missing thumbnails.
    // Photos created via /api/platform/photos already have EXIF-derived fields
    // populated at upload time, and the R2 file has been metadata-stripped —
    // so re-extracting EXIF here would yield null. Only overwrite EXIF-derived
    // fields when the stored value is null. thumbnailUrl / blurDataUrl /
    // toneAnalysis are always refreshed because they depend on pixel data.
    for (const photo of needsMetadata) {
      current++
      send({ phase: 'thumbnail', current, total: totalToProcess, key: photo.key })

      try {
        const thumbnailKey = buildThumbnailKey(photo.key)
        const result = await generateThumbnail(client, bucket, photo.key, thumbnailKey)
        const thumbnailUrl = getPublicUrl(thumbnailKey)

        const setFields: Record<string, any> = {
          thumbnailUrl,
          toneAnalysis: result.toneAnalysis,
          blurDataUrl: result.blurDataUrl,
        }
        if (photo.exif == null && result.exif != null) setFields.exif = result.exif
        if (photo.takenAt == null && result.takenAt != null) setFields.takenAt = result.takenAt
        if (photo.width == null && result.width != null) setFields.width = result.width
        if (photo.height == null && result.height != null) setFields.height = result.height
        if (photo.cameraName == null && result.cameraName != null) setFields.cameraName = result.cameraName
        if (photo.lensName == null && result.lensName != null) setFields.lensName = result.lensName

        bulkOps.push({
          updateOne: {
            filter: { _id: photo._id },
            update: { $set: setFields },
          },
        })
        thumbnailsGenerated++
      } catch (err: any) {
        send({ phase: 'thumbnail-error', current, total: totalToProcess, key: photo.key, error: err.message || 'Unknown error' })
        thumbnailsFailed++
      }
    }

    // Backfill cameraName/lensName for existing photos that already have metadata.
    const hasMetadata = unchangedPhotos.filter(p => p.thumbnailUrl)
    for (const photo of hasMetadata) {
      const updateFields: Record<string, any> = {}

      // Backfill cameraName/lensName from stored EXIF if missing
      if (photo.cameraName == null && photo.exif) {
        const make = photo.exif?.Image?.Make != null ? String(photo.exif.Image.Make).trim() : null
        const model = photo.exif?.Image?.Model != null ? String(photo.exif.Image.Model).trim() : null
        const cam = make || model ? [make, model].filter(Boolean).join(' ') : null
        if (cam) updateFields.cameraName = cam
      }
      if (photo.lensName == null && photo.exif) {
        const lm = photo.exif?.Photo?.LensModel != null ? String(photo.exif.Photo.LensModel).trim() : null
        if (lm) updateFields.lensName = lm
      }

      if (Object.keys(updateFields).length > 0) {
        bulkOps.push({
          updateOne: {
            filter: { _id: photo._id },
            update: { $set: updateFields },
          },
        })
      }
    }

    // Phase: cleanup — delete removed photos and their thumbnails
    if (removedPhotos.length > 0) {
      for (const photo of removedPhotos) {
        try {
          const thumbnailKey = buildThumbnailKey(photo.key)
          await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: thumbnailKey }))
        } catch {
          // Thumbnail may not exist, ignore
        }
      }

      for (const photo of removedPhotos) {
        bulkOps.push({ deleteOne: { filter: { _id: photo._id } } })
      }

      send({ phase: 'cleanup', removed: removedPhotos.length })
    }

    if (bulkOps.length > 0) {
      await Photo.bulkWrite(bulkOps)
    }

    // Phase: complete
    send({
      phase: 'complete',
      total: s3Objects.length,
      added: newObjects.length,
      removed: removedPhotos.length,
      unchanged: s3Objects.length - newObjects.length,
      thumbnailsGenerated,
      thumbnailsFailed,
    })
  } catch (err: any) {
    send({ phase: 'error', message: err.message || 'Scan failed' })
  } finally {
    scanInProgress = false
    event.node.res.end()
  }
})
