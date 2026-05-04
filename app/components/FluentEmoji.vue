<script setup lang="ts">
import type { ReactionEmojiKey } from '~~/server/utils/reactions/emojiSet'

const props = withDefaults(
  defineProps<{
    name: ReactionEmojiKey
    size?: number
    alt?: string
  }>(),
  { size: 24, alt: '' },
)

const FILENAME_MAP: Record<ReactionEmojiKey, string> = {
  heartEyes: 'heart-eyes.png',
  starStruck: 'star-struck.png',
  thumbsUp: 'thumbs-up.png',
  fire: 'fire.png',
  raisedHands: 'raising-hands.png',
  camera: 'camera.png',
}

const src = computed(() => `/emoji/${FILENAME_MAP[props.name]}`)
</script>

<template>
  <img
    :src="src"
    :width="size"
    :height="size"
    :alt="alt"
    loading="lazy"
    decoding="async"
    draggable="false"
  />
</template>
