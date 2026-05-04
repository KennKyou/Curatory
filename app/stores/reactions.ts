import { defineStore } from 'pinia'
import type { ReactionEmojiKey } from '~~/server/utils/reactions/emojiSet'
import { getOrCreateFingerprintId } from '../utils/fingerprint'

interface MineResponse {
  reactions: Array<{ photoSlug: string; emoji: ReactionEmojiKey }>
}

interface ToggleResponse {
  action: 'added' | 'removed'
  reactionCounts: Record<ReactionEmojiKey, number>
  topReaction: ReactionEmojiKey | null
  reactionTotal: number
}

function inFlightKey(slug: string, emoji: ReactionEmojiKey) {
  return `${slug}:${emoji}`
}

export const useReactionsStore = defineStore('reactions', () => {
  const mine = ref<Map<string, Set<ReactionEmojiKey>>>(new Map())
  const fingerprintId = ref<string | null>(null)
  const initialized = ref(false)
  const inFlight = ref<Set<string>>(new Set())

  function hasReacted(slug: string, emoji: ReactionEmojiKey): boolean {
    return mine.value.get(slug)?.has(emoji) ?? false
  }

  function isBusy(slug: string, emoji: ReactionEmojiKey): boolean {
    return inFlight.value.has(inFlightKey(slug, emoji))
  }

  function applyLocalToggle(slug: string, emoji: ReactionEmojiKey, active: boolean) {
    const next = new Map(mine.value)
    const set = new Set(next.get(slug) ?? [])
    if (active) set.add(emoji)
    else set.delete(emoji)
    if (set.size === 0) next.delete(slug)
    else next.set(slug, set)
    mine.value = next
  }

  async function init() {
    if (initialized.value) return
    if (typeof window === 'undefined') return

    const id = getOrCreateFingerprintId()
    fingerprintId.value = id

    try {
      const res = await $fetch<MineResponse>('/api/photos/reactions/mine', {
        query: { fingerprintId: id },
      })
      const next = new Map<string, Set<ReactionEmojiKey>>()
      for (const { photoSlug, emoji } of res.reactions) {
        const bucket = next.get(photoSlug) ?? new Set<ReactionEmojiKey>()
        bucket.add(emoji)
        next.set(photoSlug, bucket)
      }
      mine.value = next
      initialized.value = true
    } catch (err) {
      console.warn('[reactions] init failed', err)
    }
  }

  async function toggleReaction(
    slug: string,
    emoji: ReactionEmojiKey,
  ): Promise<ToggleResponse | null> {
    if (!fingerprintId.value) {
      fingerprintId.value = getOrCreateFingerprintId()
    }

    const key = inFlightKey(slug, emoji)
    if (inFlight.value.has(key)) return null
    inFlight.value.add(key)

    const wasActive = hasReacted(slug, emoji)
    applyLocalToggle(slug, emoji, !wasActive)

    try {
      const res = await $fetch<ToggleResponse>(`/api/photos/${slug}/reactions`, {
        method: 'POST',
        body: { emoji, fingerprintId: fingerprintId.value },
      })
      const serverActive = res.action === 'added'
      if (serverActive !== !wasActive) {
        applyLocalToggle(slug, emoji, serverActive)
      }
      return res
    } catch (err) {
      applyLocalToggle(slug, emoji, wasActive)
      console.warn('[reactions] toggle failed', err)
      throw err
    } finally {
      inFlight.value.delete(key)
    }
  }

  return {
    mine,
    fingerprintId,
    initialized,
    hasReacted,
    isBusy,
    init,
    toggleReaction,
  }
})
