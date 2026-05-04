import { REACTION_EMOJI_KEYS, type ReactionEmojiKey } from './emojiSet'

export interface ReactionCountsShape {
  heartEyes: number
  starStruck: number
  thumbsUp: number
  fire: number
  raisedHands: number
  camera: number
}

/**
 * Given a counts map, return the emoji key with the highest count.
 * Ties break by the declaration order in `REACTION_EMOJI_KEYS`.
 * Returns null when every count is 0.
 */
export function recomputeTopReaction(
  counts: ReactionCountsShape,
): ReactionEmojiKey | null {
  let best: ReactionEmojiKey | null = null
  let bestCount = 0
  for (const key of REACTION_EMOJI_KEYS) {
    const count = counts[key] ?? 0
    if (count > bestCount) {
      best = key
      bestCount = count
    }
  }
  return best
}

export function sumReactionTotal(counts: ReactionCountsShape): number {
  let sum = 0
  for (const key of REACTION_EMOJI_KEYS) {
    sum += counts[key] ?? 0
  }
  return sum
}
