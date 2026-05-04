<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { toast } from 'vue-sonner'
import { REACTION_EMOJI_KEYS, type ReactionEmojiKey } from '~~/server/utils/reactions/emojiSet'
import { useReactionsStore } from '@/stores/reactions'

type ReactionCounts = Record<ReactionEmojiKey, number>

interface Photo {
  id: string
  url: string
  thumbnailUrl: string | null
  key: string
  slug?: string
  width?: number | null
  height?: number | null
  size?: number
  exif?: Record<string, any> | null
  takenAt?: string | null
  reactionCounts?: ReactionCounts
  topReaction?: ReactionEmojiKey | null
  reactionTotal?: number
}

const props = withDefaults(defineProps<{
  photos: Photo[]
  initialIndex: number
  rect: DOMRect
  mode?: 'expand' | 'fade'
}>(), {
  mode: 'expand',
})

const emit = defineEmits<{
  close: []
  navigate: [index: number]
}>()

const currentIndex = ref(props.initialIndex)
const currentPhoto = computed(() => props.photos[currentIndex.value]!)

const { t } = useI18n()

const reactionsStore = useReactionsStore()
const reactionKeys = REACTION_EMOJI_KEYS

function reactionCountFor(emoji: ReactionEmojiKey): number {
  return currentPhoto.value.reactionCounts?.[emoji] ?? 0
}

async function onReactionClick(emoji: ReactionEmojiKey) {
  const slug = currentPhoto.value.slug
  if (!slug) return
  if (reactionsStore.isBusy(slug, emoji)) return

  const photo = currentPhoto.value as Photo
  if (!photo.reactionCounts) {
    photo.reactionCounts = {
      heartEyes: 0, starStruck: 0, thumbsUp: 0, fire: 0, raisedHands: 0, camera: 0,
    }
  }
  const wasActive = reactionsStore.hasReacted(slug, emoji)
  const delta = wasActive ? -1 : 1
  photo.reactionCounts[emoji] = Math.max(0, (photo.reactionCounts[emoji] ?? 0) + delta)
  photo.reactionTotal = Math.max(0, (photo.reactionTotal ?? 0) + delta)

  try {
    const res = await reactionsStore.toggleReaction(slug, emoji)
    if (res) {
      photo.reactionCounts = res.reactionCounts
      photo.topReaction = res.topReaction
      photo.reactionTotal = res.reactionTotal
    } else {
      // Store refused the toggle (an in-flight request is already running
      // for this slug+emoji). Roll back the optimistic delta so UI does not
      // drift from the server state.
      photo.reactionCounts[emoji] = Math.max(0, (photo.reactionCounts[emoji] ?? 0) - delta)
      photo.reactionTotal = Math.max(0, (photo.reactionTotal ?? 0) - delta)
    }
  } catch {
    photo.reactionCounts[emoji] = Math.max(0, (photo.reactionCounts[emoji] ?? 0) - delta)
    photo.reactionTotal = Math.max(0, (photo.reactionTotal ?? 0) - delta)
    toast.error(t('lightbox.reactions.error'))
  }
}
const SMALL_SCREEN_BREAKPOINT = 1024
const ORIGINAL_IMAGE_CACHE_LIMIT = 5

const effectiveMode = computed(() => {
  if (props.mode === 'fade') return 'fade'
  return 'expand'
})

// Navigation state
const isMultiPhoto = computed(() => props.photos.length > 1)
const slideDirection = ref<'left' | 'right' | null>(null)
const isSliding = ref(false)
const slideTranslateX = ref(0)
const slideTransitionEnabled = ref(true)
const inLightbox = ref(false)
const overStrip = ref(false)
// "Image area hover": cursor is inside the lightbox but not over the thumbnail
// strip. Drives prev/next arrows and reaction overlay.
const imageHovered = computed(
  () => inLightbox.value && !overStrip.value,
)

// State
const phase = ref<'entering' | 'open' | 'leaving' | 'done'>('entering')
const imgSrc = ref(currentPhoto.value.thumbnailUrl || currentPhoto.value.url)
const downloading = ref(false)
const downloadedBytes = ref(0)
const totalBytes = ref<number | null>(null)
const objectUrl = ref<string | null>(null)
const abortController = ref<AbortController | null>(null)
const originalImageCache = new Map<string, { objectUrl: string }>()
const imageEl = ref<HTMLImageElement | null>(null)
const thumbnailRefs = ref<HTMLElement[]>([])

// Reactive viewport size (triggers imageStyle recomputation on resize)
const viewportW = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
const viewportH = ref(typeof window !== 'undefined' ? window.innerHeight : 800)

// Mobile detection
const isMobileView = ref(false)

const effectivePanelW = computed(() => 0)

// Share popover
const shareOpen = ref(false)
const sharePopoverEl = ref<HTMLElement | null>(null)
const shareButtonEl = ref<HTMLElement | null>(null)
const copied = ref(false)

function toggleShare() {
  shareOpen.value = !shareOpen.value
}

function onShareClickOutside(e: MouseEvent) {
  if (
    shareOpen.value
    && sharePopoverEl.value
    && !sharePopoverEl.value.contains(e.target as Node)
    && shareButtonEl.value
    && !shareButtonEl.value.contains(e.target as Node)
  ) {
    shareOpen.value = false
  }
}

const shareUrl = computed(() => {
  const slug = currentPhoto.value.slug
  if (!slug) return ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/photos/${slug}`
})

const ogImageUrl = computed(() => {
  const slug = currentPhoto.value.slug
  if (!slug) return ''
  return `/api/og/photos/${slug}`
})

async function copyShareUrl() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {}
}

function shareToLine() {
  window.open(`https://line.me/R/share?text=${encodeURIComponent(shareUrl.value)}`, '_blank')
}

function shareToFacebook() {
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl.value)}`, '_blank')
}

function shareToX() {
  window.open(`https://x.com/intent/tweet?url=${encodeURIComponent(shareUrl.value)}`, '_blank')
}

function updateMobileView() {
  viewportW.value = window.innerWidth
  viewportH.value = window.innerHeight
  isMobileView.value = window.innerWidth < SMALL_SCREEN_BREAKPOINT
}

// Swipe navigation
const swipeStartX = ref<number | null>(null)
const swipeStartY = ref<number | null>(null)
const swipeOffsetX = ref(0)
const isSwiping = ref(false)

function onImageTouchStart(e: TouchEvent) {
  if (!isMultiPhoto.value || phase.value !== 'open' || isSliding.value) return
  swipeStartX.value = e.touches[0]!.clientX
  swipeStartY.value = e.touches[0]!.clientY
  swipeOffsetX.value = 0
  isSwiping.value = false
}

function onImageTouchMove(e: TouchEvent) {
  if (swipeStartX.value == null || swipeStartY.value == null || isSliding.value) return

  const dx = e.touches[0]!.clientX - swipeStartX.value
  const dy = e.touches[0]!.clientY - swipeStartY.value

  if (!isSwiping.value) {
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 5) {
      isSwiping.value = true
    } else if (Math.abs(dy) > Math.abs(dx)) {
      swipeStartX.value = null
      return
    }
  }

  if (isSwiping.value) {
    e.preventDefault()
    // Apply resistance at boundaries
    const atStart = currentIndex.value === 0 && dx > 0
    const atEnd = currentIndex.value === props.photos.length - 1 && dx < 0
    swipeOffsetX.value = (atStart || atEnd) ? dx / 3 : dx
    slideTranslateX.value = swipeOffsetX.value
  }
}

function onImageTouchEnd() {
  if (swipeStartX.value == null || !isSwiping.value) {
    swipeStartX.value = null
    swipeStartY.value = null
    return
  }

  const dx = swipeOffsetX.value

  if (Math.abs(dx) >= 50) {
    if (dx < 0 && currentIndex.value < props.photos.length - 1) {
      slideTranslateX.value = 0
      navigateTo(currentIndex.value + 1, 'left')
    } else if (dx > 0 && currentIndex.value > 0) {
      slideTranslateX.value = 0
      navigateTo(currentIndex.value - 1, 'right')
    } else {
      // At boundary, snap back
      slideTranslateX.value = 0
    }
  } else {
    // Below threshold, snap back
    slideTranslateX.value = 0
  }

  swipeStartX.value = null
  swipeStartY.value = null
  swipeOffsetX.value = 0
  isSwiping.value = false
}

const progressPercent = computed(() => {
  if (totalBytes.value == null || totalBytes.value === 0) return null
  return Math.round((downloadedBytes.value / totalBytes.value) * 100)
})

function getCachedOriginalImage(photoId: string): string | null {
  const entry = originalImageCache.get(photoId)
  if (!entry) return null
  originalImageCache.delete(photoId)
  originalImageCache.set(photoId, entry)
  return entry.objectUrl
}

function cacheOriginalImage(photoId: string, nextObjectUrl: string) {
  const existing = originalImageCache.get(photoId)
  if (existing) {
    URL.revokeObjectURL(existing.objectUrl)
    originalImageCache.delete(photoId)
  }
  originalImageCache.set(photoId, { objectUrl: nextObjectUrl })
  while (originalImageCache.size > ORIGINAL_IMAGE_CACHE_LIMIT) {
    const oldest = originalImageCache.entries().next().value as [string, { objectUrl: string }] | undefined
    if (!oldest) break
    originalImageCache.delete(oldest[0])
    URL.revokeObjectURL(oldest[1].objectUrl)
  }
}

function clearOriginalImageCache() {
  for (const entry of originalImageCache.values()) {
    URL.revokeObjectURL(entry.objectUrl)
  }
  originalImageCache.clear()
  objectUrl.value = null
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Calculate final image dimensions and position
function getPhotoAspect() {
  const photo = currentPhoto.value
  if (photo.width && photo.height) return photo.width / photo.height
  const pw = photo.exif?.Photo?.PixelXDimension
  const ph = photo.exif?.Photo?.PixelYDimension
  if (pw && ph) return pw / ph
  return props.rect.width / props.rect.height
}

function getFinalImageLayout(aspect?: number) {
  const vw = viewportW.value
  const vh = viewportH.value
  const a = aspect ?? getPhotoAspect()
  const availableW = vw - effectivePanelW.value
  const stripH = isMultiPhoto.value ? 64 : 0 // h-16 thumbnail strip
  const availableH = vh - stripH
  let targetW = availableH * a
  let targetH = availableH
  if (targetW > availableW) {
    targetW = availableW
    targetH = targetW / a
  }
  const targetX = (availableW - targetW) / 2
  const targetY = (availableH - targetH) / 2
  return { targetW, targetH, targetX, targetY }
}

// Use original rect aspect for the enter/leave animation
function getInitialImageLayout() {
  const aspect = props.rect.width / props.rect.height
  return getFinalImageLayout(aspect)
}

// Calculate transform from final position to thumbnail rect (uses initial rect aspect)
function getTransformToRect(): string {
  const { targetW, targetH, targetX, targetY } = getInitialImageLayout()

  const scaleX = props.rect.width / targetW
  const scaleY = props.rect.height / targetH

  const targetCX = targetX + targetW / 2
  const targetCY = targetY + targetH / 2
  const rectCX = props.rect.left + props.rect.width / 2
  const rectCY = props.rect.top + props.rect.height / 2
  const tx = rectCX - targetCX
  const ty = rectCY - targetCY

  return `translate(${tx}px, ${ty}px) scale(${scaleX}, ${scaleY})`
}

// Image style
const imageStyle = computed(() => {
  if (effectiveMode.value === 'fade') {
    const { targetW, targetH, targetX, targetY } = getFinalImageLayout()
    const base = {
      position: 'fixed' as const,
      top: `${targetY}px`,
      left: `${targetX}px`,
      width: `${targetW}px`,
      height: `${targetH}px`,
      transformOrigin: 'center center',
    }
    if (phase.value === 'entering') {
      return { ...base, opacity: '0', transform: 'scale(0.98)', transition: 'none' }
    }
    if (phase.value === 'leaving') {
      return { ...base, opacity: '0', transform: 'scale(0.98)', transition: 'opacity 220ms ease-in, transform 220ms ease-in' }
    }
    const tx = slideTranslateX.value
    const slideTransition = !slideTransitionEnabled.value ? 'none' : (isSliding.value ? 'transform 300ms ease' : 'transform 300ms ease-out')
    const layoutTransition = 'top 300ms ease-in-out, left 300ms ease-in-out, width 300ms ease-in-out, height 300ms ease-in-out'
    const transition = slideTransition === 'none' ? layoutTransition : `${slideTransition}, ${layoutTransition}, opacity 220ms ease-out`
    return { ...base, opacity: '1', transform: tx !== 0 ? `translateX(${tx}px)` : 'none', transition }
  }

  if (phase.value === 'entering' || (phase.value === 'leaving' && currentIndex.value === props.initialIndex)) {
    const { targetW, targetH, targetX, targetY } = getInitialImageLayout()
    const base = {
      position: 'fixed' as const,
      top: `${targetY}px`,
      left: `${targetX}px`,
      width: `${targetW}px`,
      height: `${targetH}px`,
      transformOrigin: 'center center',
    }
    if (phase.value === 'entering') {
      return { ...base, transform: getTransformToRect(), transition: 'none' }
    }
    return { ...base, transform: getTransformToRect(), transition: 'transform 300ms ease-in' }
  }

  // open or leaving-with-fade: use current photo's aspect
  const { targetW, targetH, targetX, targetY } = getFinalImageLayout()
  const base = {
    position: 'fixed' as const,
    top: `${targetY}px`,
    left: `${targetX}px`,
    width: `${targetW}px`,
    height: `${targetH}px`,
    transformOrigin: 'center center',
  }

  if (phase.value === 'leaving') {
    return { ...base, transform: 'scale(0.95)', opacity: '0', transition: 'transform 300ms ease-in, opacity 300ms ease-in' }
  }

  // open
  const tx = slideTranslateX.value
  const slideTransition = !slideTransitionEnabled.value ? 'none' : (isSliding.value ? 'transform 300ms ease' : 'transform 300ms ease-out')
  const layoutTransition = 'top 300ms ease-in-out, left 300ms ease-in-out, width 300ms ease-in-out, height 300ms ease-in-out'
  const transition = slideTransition === 'none' ? layoutTransition : `${slideTransition}, ${layoutTransition}`
  return { ...base, transform: tx !== 0 ? `translateX(${tx}px)` : 'none', transition }
})

async function downloadOriginal() {
  // Abort any previous download
  if (abortController.value) {
    abortController.value.abort()
    abortController.value = null
  }

  const originalUrl = currentPhoto.value.url
  const thumbnailUrl = currentPhoto.value.thumbnailUrl
  if (!thumbnailUrl || originalUrl === thumbnailUrl) return

  const cachedObjectUrl = getCachedOriginalImage(currentPhoto.value.id)
  if (cachedObjectUrl) {
    objectUrl.value = cachedObjectUrl
    imgSrc.value = cachedObjectUrl
    downloading.value = false
    downloadedBytes.value = 0
    totalBytes.value = null
    return
  }

  const controller = new AbortController()
  abortController.value = controller

  downloading.value = true
  downloadedBytes.value = 0
  totalBytes.value = null

  try {
    const response = await fetch(originalUrl, { signal: controller.signal })
    const contentLength = response.headers.get('content-length')
    if (contentLength) {
      totalBytes.value = parseInt(contentLength, 10)
    }

    const reader = response.body?.getReader()
    if (!reader) return

    const chunks: BlobPart[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      downloadedBytes.value += value.byteLength
    }

    const blob = new Blob(chunks)
    objectUrl.value = URL.createObjectURL(blob)
    cacheOriginalImage(currentPhoto.value.id, objectUrl.value)
    imgSrc.value = objectUrl.value
  } catch (e: any) {
    if (e.name === 'AbortError') return
    imgSrc.value = originalUrl
  } finally {
    if (abortController.value === controller) {
      abortController.value = null
    }
    downloading.value = false
  }
}

async function navigateTo(index: number, direction: 'left' | 'right') {
  if (index < 0 || index >= props.photos.length || isSliding.value) return

  isSliding.value = true
  slideDirection.value = direction
  shareOpen.value = false

  // Slide out current photo
  const slideOutX = direction === 'left' ? -window.innerWidth : window.innerWidth
  slideTranslateX.value = slideOutX

  await new Promise(r => setTimeout(r, 300))

  // Abort in-progress download
  if (abortController.value) {
    abortController.value.abort()
    abortController.value = null
  }

  // Update index and reset image to new photo's thumbnail
  currentIndex.value = index
  const newPhoto = currentPhoto.value
  imgSrc.value = newPhoto.thumbnailUrl || newPhoto.url

  // Reset download state
  downloading.value = false
  downloadedBytes.value = 0
  totalBytes.value = null
  if (objectUrl.value) {
    objectUrl.value = null
  }

  // Position new photo off-screen (no transition)
  slideTransitionEnabled.value = false
  const slideInX = direction === 'left' ? window.innerWidth : -window.innerWidth
  slideTranslateX.value = slideInX
  await nextTick()
  imageEl.value?.getBoundingClientRect() // force reflow

  // Slide in (with transition)
  slideTransitionEnabled.value = true
  slideTranslateX.value = 0
  await new Promise(r => setTimeout(r, 300))

  isSliding.value = false
  slideDirection.value = null

  emit('navigate', index)

  // Scroll thumbnail into view after navigation.
  nextTick(() => {
    const el = thumbnailRefs.value[index]
    if (el) {
      el.scrollIntoView({ inline: 'center', behavior: 'smooth' })
    }
  })

  downloadOriginal()
}

function startClose() {
  phase.value = 'leaving'
}

function onTransitionEnd(e: TransitionEvent) {
  if (phase.value === 'leaving' && ((effectiveMode.value === 'fade' && e.propertyName === 'opacity') || (effectiveMode.value === 'expand' && e.propertyName === 'transform'))) {
    clearOriginalImageCache()
    emit('close')
  }
}

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    startClose()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    startClose()
  }
  if (!isMultiPhoto.value || phase.value !== 'open') return
  if (e.key === 'ArrowLeft' && currentIndex.value > 0) {
    navigateTo(currentIndex.value - 1, 'right')
  }
  if (e.key === 'ArrowRight' && currentIndex.value < props.photos.length - 1) {
    navigateTo(currentIndex.value + 1, 'left')
  }
}

onMounted(() => {
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('click', onShareClickOutside, true)
  updateMobileView()
  window.addEventListener('resize', updateMobileView)

  requestAnimationFrame(() => {
    imageEl.value?.getBoundingClientRect()
    phase.value = 'open'
  })
  downloadOriginal()
})

onUnmounted(() => {
  document.body.style.overflow = ''
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('click', onShareClickOutside, true)
  if (abortController.value) {
    abortController.value.abort()
    abortController.value = null
  }
  clearOriginalImageCache()
  window.removeEventListener('resize', updateMobileView)
  if (abortController.value) {
    abortController.value.abort()
  }
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value)
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50"
      :style="{ transition: 'background-color 300ms' }"
      @click="onBackdropClick"
      @mouseenter="inLightbox = true"
      @mouseleave="inLightbox = false"
    >
      <!-- Background: solid black base + blurred thumbnail overlay -->
      <div class="absolute inset-0 bg-black overflow-hidden">
        <img
          :src="currentPhoto.thumbnailUrl || currentPhoto.url"
          :alt="currentPhoto.key"
          class="absolute inset-0 w-full h-full object-cover blur-[40px]"
          :class="isMobileView ? 'scale-150' : 'scale-120'"
        />
        <div class="absolute inset-0" :class="isMobileView ? 'bg-black/60' : 'bg-black/50'" />
      </div>

      <!-- Close button -->
      <button
        v-if="phase === 'open'"
        class="fixed top-4 z-20 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/20 transition-all duration-300 ease-in-out"
        style="right: 16px"
        @click="startClose"
      >
        <Icon icon="material-symbols:close" class="h-5 w-5" />
      </button>

      <!-- Arrow buttons (desktop only, visible when hovering image) -->
      <button
        v-if="isMultiPhoto && !isMobileView && phase === 'open' && currentIndex > 0"
        class="fixed z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-opacity"
        :class="imageHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'"
        :style="{ left: '16px', top: '50%', transform: 'translateY(-50%)' }"
        @click="navigateTo(currentIndex - 1, 'right')"
      >
        <Icon icon="material-symbols:chevron-left" class="h-6 w-6" />
      </button>
      <button
        v-if="isMultiPhoto && !isMobileView && phase === 'open' && currentIndex < photos.length - 1"
        class="fixed z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all duration-300 ease-in-out"
        :class="imageHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'"
        :style="{ right: `${effectivePanelW + 16}px`, top: '50%', transform: 'translateY(-50%)' }"
        @click="navigateTo(currentIndex + 1, 'left')"
      >
        <Icon icon="material-symbols:chevron-right" class="h-6 w-6" />
      </button>

      <!-- Image -->
      <img
        ref="imageEl"
        :src="imgSrc"
        :alt="currentPhoto.key"
        :style="imageStyle"
        class="z-10 object-contain will-change-transform"
        @transitionend="onTransitionEnd"
        @touchstart="onImageTouchStart"
        @touchmove="onImageTouchMove"
        @touchend="onImageTouchEnd"
      />

      <!-- Thumbnail strip -->
      <div
        v-if="isMultiPhoto && phase === 'open'"
        class="fixed bottom-0 left-0 z-20 h-16 flex items-center bg-black/40 backdrop-blur-sm overflow-x-auto transition-[width] duration-300 ease-in-out"
        :style="{ width: isMobileView ? '100vw' : `calc(100vw - ${effectivePanelW}px)`, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }"
        @mouseenter="overStrip = true"
        @mouseleave="overStrip = false"
      >
        <div class="flex gap-1 px-2">
          <button
            v-for="(p, i) in photos"
            :key="p.id"
            :ref="(el: any) => { if (el) thumbnailRefs[i] = el.$el || el }"
            class="shrink-0 h-12 overflow-hidden transition-all"
            :class="i === currentIndex ? 'ring-2 ring-white opacity-100' : 'opacity-60 hover:opacity-80 grayscale'"
            :style="{ width: (p.width && p.height) ? `${(p.width / p.height) * 48}px` : '48px' }"
            @click="navigateTo(i, i > currentIndex ? 'left' : 'right')"
          >
            <img
              :src="p.thumbnailUrl || p.url"
              :alt="p.key"
              class="h-full w-full object-cover"
            />
          </button>
        </div>
      </div>

      <!-- Reaction overlay (bottom-right, hover-reveal on desktop, always on mobile) -->
      <div
        v-if="phase === 'open'"
        class="fixed z-20 flex items-center gap-1.5 transition-opacity duration-200"
        :style="{
          bottom: isMultiPhoto ? '80px' : '16px',
          right: isMobileView ? '16px' : `${effectivePanelW + 16}px`,
        }"
        :class="isMobileView ? 'opacity-100' : (imageHovered ? 'opacity-100' : 'opacity-0 pointer-events-none')"
      >
        <button
          v-for="key in reactionKeys"
          :key="key"
          :disabled="!currentPhoto.slug || reactionsStore.isBusy(currentPhoto.slug, key)"
          :aria-label="t('lightbox.reactions.title')"
          class="relative flex items-center gap-1 rounded-full px-2.5 py-1 backdrop-blur-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          :class="currentPhoto.slug && reactionsStore.hasReacted(currentPhoto.slug, key) ? 'bg-white/25 ring-1 ring-white/40' : 'bg-black/50 hover:bg-black/70'"
          @click.stop="onReactionClick(key)"
        >
          <FluentEmoji :name="key" :size="22" />
          <span v-if="reactionCountFor(key) > 0" class="text-[11px] font-medium text-white tabular-nums">
            {{ reactionCountFor(key) }}
          </span>
        </button>
      </div>

      <!-- Share button (top-right, next to close button) -->
      <button
        v-if="phase === 'open'"
        ref="shareButtonEl"
        class="fixed top-4 z-30 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/20 transition-all duration-300 ease-in-out"
        style="right: 68px"
        @click="toggleShare"
      >
        <Icon icon="material-symbols:share-outline" class="h-5 w-5" />
      </button>

      <!-- Share modal backdrop -->
      <Transition
        enter-active-class="transition-opacity duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="shareOpen && phase === 'open'"
          class="fixed inset-0 z-40 bg-black/50"
          @click="shareOpen = false"
        />
      </Transition>

      <!-- Share modal -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="shareOpen && phase === 'open'"
          ref="sharePopoverEl"
          class="fixed z-50 w-[28rem] max-w-[calc(100vw-2rem)] rounded-xl bg-black/80 backdrop-blur-md text-white p-6 shadow-2xl border border-white/10"
          style="top: 50%; left: 50%; transform: translate(-50%, -50%)"
        >
          <!-- Header -->
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium text-white/80">{{ t('lightbox.share.title') }}</h3>
            <button
              class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              @click="shareOpen = false"
            >
              <Icon icon="material-symbols:close" class="h-4 w-4" />
            </button>
          </div>

          <!-- OG Image Preview -->
          <img
            :src="ogImageUrl"
            :alt="currentPhoto.key"
            class="w-full rounded-lg mb-4"
            style="aspect-ratio: 1200/630"
          />

          <!-- URL + Copy (inline button) -->
          <div class="relative mb-4">
            <div class="w-full bg-white/10 rounded-lg pl-3 pr-10 py-2.5 text-xs text-white/70 truncate">
              {{ shareUrl }}
            </div>
            <button
              class="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/15 transition-colors"
              @click="copyShareUrl"
            >
              <Icon :icon="copied ? 'material-symbols:check' : 'material-symbols:content-copy-outline'" class="h-4 w-4" />
            </button>
          </div>

          <!-- Social share buttons (icon only) -->
          <div class="flex justify-center gap-4">
            <button
              class="w-10 h-10 rounded-full bg-[#06C755]/20 hover:bg-[#06C755]/30 flex items-center justify-center transition-colors"
              :title="t('lightbox.share.line')"
              @click="shareToLine"
            >
              <Icon icon="simple-icons:line" class="h-5 w-5 text-[#06C755]" />
            </button>
            <button
              class="w-10 h-10 rounded-full bg-[#1877F2]/20 hover:bg-[#1877F2]/30 flex items-center justify-center transition-colors"
              :title="t('lightbox.share.facebook')"
              @click="shareToFacebook"
            >
              <Icon icon="mdi:facebook" class="h-5 w-5 text-[#1877F2]" />
            </button>
            <button
              class="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              :title="t('lightbox.share.x')"
              @click="shareToX"
            >
              <Icon icon="simple-icons:x" class="h-5 w-5" />
            </button>
          </div>
        </div>
      </Transition>

      <!-- Loading indicator -->
      <div
        v-if="downloading && phase === 'open'"
        class="fixed bottom-8 z-20 flex items-center gap-3 bg-black/70 text-white text-sm px-4 py-2.5 rounded-lg transition-[right] duration-300 ease-in-out"
        :style="{ right: isMobileView ? '16px' : `${effectivePanelW + 32}px` }"
      >
        <svg class="animate-spin h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>

        <div class="flex flex-col leading-tight">
          <span v-if="progressPercent != null" class="font-medium">{{ progressPercent }}%</span>
          <span class="text-white/70 text-xs">
            <template v-if="totalBytes != null">
              {{ formatBytes(downloadedBytes) }} / {{ formatBytes(totalBytes) }}
            </template>
            <template v-else>
              {{ formatBytes(downloadedBytes) }}
            </template>
          </span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overflow-x-auto::-webkit-scrollbar {
  display: none;
}
</style>
