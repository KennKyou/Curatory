<script setup lang="ts">
import { defaultExhibitionSettings, type SiteSettingsResponse } from '~~/server/types/api'

const photos = ref<any[]>([])
const exhibitionSelection = ref<{ coverPhoto: any | null; sections: { id: string, photos: any[] }[] }>({ coverPhoto: null, sections: [] })
const selectedIndex = ref<number | null>(null)
const selectedRect = ref<DOMRect | null>(null)
const selectedLightboxMode = ref<'expand' | 'fade'>('expand')
const initialError = ref(false)

const { data: siteSettings } = await useFetch<SiteSettingsResponse | null>('/api/site-settings', { default: () => null })
const exhibitionSettings = computed(() => siteSettings.value?.exhibition ?? defaultExhibitionSettings())

function uniquePhotosById(items: any[]): any[] {
  const seen = new Set<string>()
  const unique: any[] = []
  for (const photo of items.filter(Boolean)) {
    if (seen.has(photo.id)) continue
    seen.add(photo.id)
    unique.push(photo)
  }
  return unique
}

const lightboxPhotos = computed(() =>
  uniquePhotosById([
    exhibitionSelection.value.coverPhoto,
    ...exhibitionSelection.value.sections.flatMap(section => section.photos),
  ]),
)

function onSelectPhoto(e: { photo: any; rect: DOMRect; mode?: 'expand' | 'fade' }) {
  const idx = lightboxPhotos.value.findIndex((p: any) => p.id === e.photo.id)
  selectedIndex.value = idx >= 0 ? idx : 0
  selectedRect.value = e.rect
  selectedLightboxMode.value = e.mode ?? 'expand'
  if (typeof window !== 'undefined') {
    history.replaceState(history.state, '', '/photos/' + e.photo.slug)
  }
}

function onNavigate(index: number) {
  if (typeof window !== 'undefined') {
    history.replaceState(history.state, '', '/photos/' + lightboxPhotos.value[index].slug)
  }
}

function onCloseLightbox() {
  selectedIndex.value = null
  selectedRect.value = null
  if (typeof window !== 'undefined') {
    history.replaceState(history.state, '', '/')
  }
}

async function loadExhibitionPhotos() {
  try {
    const data = await $fetch('/api/photos', { query: { page: 1 } })
    photos.value = data.photos
    exhibitionSelection.value = data.exhibitionSelection ?? { coverPhoto: null, sections: [] }
  } catch {
    initialError.value = true
  }
}

await loadExhibitionPhotos()
</script>

<template>
  <div class="min-h-screen bg-background">
    <div v-if="initialError" class="flex min-h-screen items-center justify-center px-6 text-center text-muted-foreground">
      Exhibition is not configured.
    </div>

    <ExhibitionLayout
      v-else
      :photos="photos"
      :exhibition="exhibitionSettings"
      :exhibition-cover-photo="exhibitionSelection.coverPhoto"
      :exhibition-section-photos="exhibitionSelection.sections"
      @select="onSelectPhoto"
    />

    <PhotoLightbox
      v-if="selectedIndex != null"
      :photos="lightboxPhotos"
      :initial-index="selectedIndex"
      :rect="selectedRect!"
      :mode="selectedLightboxMode"
      @close="onCloseLightbox"
      @navigate="onNavigate"
    />
  </div>
</template>
