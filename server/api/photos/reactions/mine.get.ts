import { Photo } from '~~/server/models/Photo'
import { Reaction } from '~~/server/models/Reaction'
import { isValidFingerprintId } from '~~/server/utils/reactions/fingerprint'
import { getPublicOwnerUser } from '~~/server/utils/publicOwner'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const fingerprintId = query.fingerprintId

  if (!isValidFingerprintId(fingerprintId)) {
    throw createError({ statusCode: 400, message: 'Invalid fingerprintId' })
  }

  const admin = await getPublicOwnerUser()
  if (!admin) {
    return { reactions: [] }
  }

  // Start from the visitor's reactions (indexed on fingerprintId), then resolve
  // to admin-owned photos. Avoids scanning the entire admin photo set on every
  // request and drops references to deleted / non-admin photos silently.
  const reactions = await Reaction.find({ fingerprintId })
    .select('photoId emoji')
    .lean()

  if (reactions.length === 0) {
    return { reactions: [] }
  }

  const photos = await Photo.find({
    _id: { $in: reactions.map((r) => r.photoId) },
    userId: admin._id,
  })
    .select('_id slug')
    .lean()

  const slugById = new Map(photos.map((p) => [p._id.toString(), p.slug]))

  return {
    reactions: reactions
      .map((r) => ({
        photoSlug: slugById.get(r.photoId.toString()),
        emoji: r.emoji,
      }))
      .filter(
        (r): r is { photoSlug: string; emoji: typeof r.emoji } =>
          typeof r.photoSlug === 'string',
      ),
  }
})
