import { Photo, type IPhoto } from '~~/server/models/Photo'
import { Reaction } from '~~/server/models/Reaction'
import { isValidReactionEmoji } from '~~/server/utils/reactions/emojiSet'
import { isValidFingerprintId } from '~~/server/utils/reactions/fingerprint'
import {
  recomputeTopReaction,
  type ReactionCountsShape,
} from '~~/server/utils/reactions/recompute'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, message: 'Slug is required' })
  }

  const body = await readBody(event)
  const emoji = body?.emoji
  const fingerprintId = body?.fingerprintId

  if (!isValidReactionEmoji(emoji)) {
    throw createError({ statusCode: 400, message: 'Invalid emoji key' })
  }
  if (!isValidFingerprintId(fingerprintId)) {
    throw createError({ statusCode: 400, message: 'Invalid fingerprintId' })
  }

  const photo = await Photo.findOne({ slug }).select('_id').lean<Pick<IPhoto, '_id'>>()
  if (!photo) {
    throw createError({ statusCode: 404, message: 'Photo not found' })
  }

  // Step 1: mutate the authoritative Reaction record (source of truth).
  let action: 'added' | 'removed'
  let delta: -1 | 0 | 1
  const existing = await Reaction.findOne({
    photoId: photo._id,
    emoji,
    fingerprintId,
  }).select('_id')

  if (existing) {
    await Reaction.deleteOne({ _id: existing._id })
    action = 'removed'
    delta = -1
  } else {
    try {
      await Reaction.create({ photoId: photo._id, emoji, fingerprintId })
      action = 'added'
      delta = 1
    } catch (err: any) {
      // Unique-index race: a concurrent request already inserted this tuple
      // and will (or did) bump the counter itself. Skip the counter update
      // here to avoid double-increment.
      if (err?.code !== 11000) throw err
      action = 'added'
      delta = 0
    }
  }

  // Step 2: update denormalized counters with floor-0 protection via pipeline.
  // Use the underlying collection to bypass mongoose's guard against array
  // updates; aggregation pipeline updates are a native MongoDB feature.
  // $ifNull guards against Photo docs that predate the schema defaults — a
  // missing field otherwise turns $add into null and silently resets to 0.
  try {
    if (delta !== 0) {
      await Photo.collection.updateOne({ _id: photo._id }, [
        {
          $set: {
            [`reactionCounts.${emoji}`]: {
              $max: [
                { $add: [{ $ifNull: [`$reactionCounts.${emoji}`, 0] }, delta] },
                0,
              ],
            },
            reactionTotal: {
              $max: [
                { $add: [{ $ifNull: ['$reactionTotal', 0] }, delta] },
                0,
              ],
            },
          },
        },
      ])
    }

    const refreshed = await Photo.findById(photo._id)
      .select('reactionCounts topReaction reactionTotal')
      .lean<Pick<IPhoto, 'reactionCounts' | 'topReaction' | 'reactionTotal'>>()

    if (!refreshed) {
      throw createError({ statusCode: 500, message: 'Internal error' })
    }

    const counts = refreshed.reactionCounts as ReactionCountsShape
    const nextTop = recomputeTopReaction(counts)

    if (refreshed.topReaction !== nextTop) {
      await Photo.updateOne({ _id: photo._id }, { $set: { topReaction: nextTop } })
    }

    return {
      action,
      reactionCounts: counts,
      topReaction: nextTop,
      reactionTotal: refreshed.reactionTotal,
    }
  } catch (err) {
    // Reaction doc is the source of truth; denormalized counters may drift
    // until a future reconciliation job runs. Don't leak the partial state
    // in the response.
    console.error('[reactions.post] counter sync failed', err)
    throw createError({ statusCode: 500, message: 'Internal error' })
  }
})
