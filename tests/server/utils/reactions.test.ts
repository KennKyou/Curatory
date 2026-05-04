import { describe, it, expect } from 'vitest'
import {
  REACTION_EMOJI_KEYS,
  isValidReactionEmoji,
  type ReactionEmojiKey,
} from '~/server/utils/reactions/emojiSet'

describe('REACTION_EMOJI_KEYS', () => {
  it('contains exactly the six expected emoji keys in the defined order', () => {
    expect(REACTION_EMOJI_KEYS).toEqual([
      'heartEyes',
      'starStruck',
      'thumbsUp',
      'fire',
      'raisedHands',
      'camera',
    ])
  })

  it('has length exactly six', () => {
    expect(REACTION_EMOJI_KEYS.length).toBe(6)
  })

  it('is a readonly tuple at the type level', () => {
    // Type-level check: ReactionEmojiKey is a union of the six literals.
    const sample: ReactionEmojiKey = 'fire'
    expect(sample).toBe('fire')
  })
})

describe('isValidReactionEmoji', () => {
  it('returns true for every defined emoji key', () => {
    for (const key of REACTION_EMOJI_KEYS) {
      expect(isValidReactionEmoji(key)).toBe(true)
    }
  })

  it('returns false for keys outside the defined set', () => {
    expect(isValidReactionEmoji('sad')).toBe(false)
    expect(isValidReactionEmoji('heart')).toBe(false)
    expect(isValidReactionEmoji('HeartEyes')).toBe(false) // case-sensitive
    expect(isValidReactionEmoji('')).toBe(false)
    expect(isValidReactionEmoji('fire ')).toBe(false)
  })

  it('returns false for non-string inputs', () => {
    expect(isValidReactionEmoji(null as unknown as string)).toBe(false)
    expect(isValidReactionEmoji(undefined as unknown as string)).toBe(false)
    expect(isValidReactionEmoji(123 as unknown as string)).toBe(false)
    expect(isValidReactionEmoji({} as unknown as string)).toBe(false)
  })

  it('narrows the type when returning true', () => {
    const input: string = 'fire'
    if (isValidReactionEmoji(input)) {
      const narrowed: ReactionEmojiKey = input
      expect(narrowed).toBe('fire')
    }
  })
})
