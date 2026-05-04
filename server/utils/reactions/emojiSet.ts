/**
 * Server-authoritative fixed set of photo reaction emoji keys.
 *
 * The six keys below are the only values accepted by the reaction API and the
 * only columns stored in `Photo.reactionCounts`. Changing this list requires a
 * schema migration and is intentionally hard to do by accident.
 */
export const REACTION_EMOJI_KEYS = [
  'heartEyes',
  'starStruck',
  'thumbsUp',
  'fire',
  'raisedHands',
  'camera',
] as const

export type ReactionEmojiKey = (typeof REACTION_EMOJI_KEYS)[number]

const VALID_KEYS: ReadonlySet<string> = new Set(REACTION_EMOJI_KEYS)

export function isValidReactionEmoji(value: unknown): value is ReactionEmojiKey {
  return typeof value === 'string' && VALID_KEYS.has(value)
}
