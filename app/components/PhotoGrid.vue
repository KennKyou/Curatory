<script setup lang="ts">
import { Icon } from '@iconify/vue'

const { t } = useI18n()

interface Photo {
  id: string
  url: string
  thumbnailUrl: string | null
  key: string
  slug: string
  size: number
  width: number | null
  height: number | null
  blurDataUrl: string | null
}

const props = withDefaults(defineProps<{
  photos: Photo[]
  selectedIds: Set<string>
  hasMore: boolean
  loading: boolean
}>(), {})

const emit = defineEmits<{
  loadMore: []
  toggleSelect: [id: string]
}>()

const sentinel = ref<HTMLElement | null>(null)

// Responsive columns
const columns = ref(4)

function updateColumns() {
  if (import.meta.server) return
  const w = window.innerWidth
  if (w < 768) columns.value = 2
  else if (w < 1024) columns.value = 3
  else columns.value = 4
}

onMounted(() => {
  updateColumns()
  window.addEventListener('resize', updateColumns)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateColumns)
})

function getDisplayUrl(photo: Photo): string {
  return photo.thumbnailUrl || photo.url
}

function onThumbMounted(el: HTMLImageElement) {
  if (el.complete && el.naturalWidth > 0) {
    el.classList.remove('opacity-0')
  }
}

// Masonry distribution for the admin photo library.
const ratioCache = new Map<string, number>()
const distributedColumns = ref<Photo[][]>([])
const ready = ref(false)

function distributePhotos() {
  const colCount = columns.value
  const cols: Photo[][] = Array.from({ length: colCount }, () => [])
  const heights = new Array(colCount).fill(0)

  for (const photo of props.photos) {
    let minIdx = 0
    for (let i = 1; i < colCount; i++) {
      if (heights[i] < heights[minIdx]) minIdx = i
    }
    cols[minIdx]!.push(photo)
    heights[minIdx] += ratioCache.get(photo.id) ?? 1
  }

  distributedColumns.value = cols
  ready.value = true
}

async function preloadAndDistribute() {
  const needsPreload: Photo[] = []
  for (const photo of props.photos) {
    if (ratioCache.has(photo.id)) continue
    if (photo.width && photo.height) {
      ratioCache.set(photo.id, photo.height / photo.width)
    } else {
      needsPreload.push(photo)
    }
  }

  if (import.meta.client && needsPreload.length > 0) {
    await Promise.all(needsPreload.map(photo => new Promise<void>((resolve) => {
      const img = new window.Image()
      img.onload = () => {
        ratioCache.set(photo.id, img.naturalHeight / img.naturalWidth)
        resolve()
      }
      img.onerror = () => {
        ratioCache.set(photo.id, 1)
        resolve()
      }
      img.src = getDisplayUrl(photo)
    })))
  }

  distributePhotos()
}

watch(() => props.photos, () => {
  preloadAndDistribute()
})

watch(columns, () => {
  distributePhotos()
})

preloadAndDistribute()

onMounted(() => {
  if (!sentinel.value) return

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && props.hasMore && !props.loading) {
        emit('loadMore')
      }
    },
    { rootMargin: '200px' },
  )

  observer.observe(sentinel.value)
  onUnmounted(() => observer.disconnect())
})
</script>

<template>
  <div v-if="ready && photos.length > 0" class="flex gap-1.5">
    <div
      v-for="(col, colIdx) in distributedColumns"
      :key="colIdx"
      class="flex-1 flex flex-col gap-1.5"
    >
      <div
        v-for="photo in col"
        :key="photo.id"
        class="relative cursor-pointer group overflow-hidden"
        :class="selectedIds.has(photo.id) ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''"
        @click="emit('toggleSelect', photo.id)"
      >
        <!-- LQIP blur placeholder -->
        <img
          v-if="photo.blurDataUrl"
          :src="photo.blurDataUrl"
          alt=""
          aria-hidden="true"
          class="absolute inset-0 w-full h-full object-cover blur-[20px] scale-110"
        />
        <!-- Actual thumbnail -->
        <img
          :ref="(el) => { if (el && photo.blurDataUrl) onThumbMounted(el as HTMLImageElement) }"
          :src="getDisplayUrl(photo)"
          :alt="photo.key"
          :width="photo.width || undefined"
          :height="photo.height || undefined"
          loading="lazy"
          class="relative w-full h-auto"
          :class="photo.blurDataUrl ? 'opacity-0' : ''"
          @load="(e: Event) => { if (photo.blurDataUrl) (e.target as HTMLElement).classList.remove('opacity-0') }"
        />

        <!-- Checkbox overlay -->
        <div
          class="absolute top-2 left-2 w-5 h-5 rounded border flex items-center justify-center transition-all"
          :class="selectedIds.has(photo.id) ? 'bg-primary border-primary text-primary-foreground' : 'border-white/70 bg-black/30 opacity-0 group-hover:opacity-100'"
        >
          <Icon v-if="selectedIds.has(photo.id)" icon="material-symbols:check" class="h-3.5 w-3.5" />
        </div>

      </div>
    </div>
  </div>

  <div v-else-if="!loading && photos.length === 0" class="text-center py-12 text-muted-foreground text-sm">
    {{ t('photoLibrary.noPhotos') }}
  </div>

  <div ref="sentinel" class="h-4" />

  <div v-if="loading" class="text-center py-4 text-muted-foreground text-sm">
    {{ t('photoLibrary.loading') }}
  </div>
</template>
