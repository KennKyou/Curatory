import type { ComputedRef } from 'vue'
import type { PlatformPhotoItem, PlatformPhotosResponse } from '~~/server/types/api'

export function useExhibitionPhotos(selectedPhotoIds: ComputedRef<string[]>) {
  const { data } = useFetch<PlatformPhotosResponse>('/api/platform/photos', {
    default: () => ({ photos: [], hasMore: false, lastId: null }),
  })
  const photos = ref<PlatformPhotoItem[]>([])
  const hasMore = ref(false)
  const lastId = ref<string | null>(null)
  const loadingMore = ref(false)
  const requestedSelectedPhotoIds = ref<string[]>([])

  function mergePhotos(nextPhotos: PlatformPhotoItem[]) {
    const seen = new Set(photos.value.map(photo => photo.id))
    const next = [...photos.value]
    for (const photo of nextPhotos) {
      if (seen.has(photo.id)) continue
      seen.add(photo.id)
      next.push(photo)
    }
    photos.value = next
  }

  watch(data, (nextData) => {
    if (!nextData) return
    if (photos.value.length === 0) {
      mergePhotos(nextData.photos)
    }
    hasMore.value = nextData.hasMore
    lastId.value = nextData.lastId
  }, { immediate: true })

  const photoById = computed(() => new Map(photos.value.map(photo => [photo.id, photo])))
  const missingSelectedPhotoIds = computed(() =>
    selectedPhotoIds.value.filter(id =>
      !photoById.value.has(id) && !requestedSelectedPhotoIds.value.includes(id),
    ),
  )

  async function loadMorePhotos() {
    if (!hasMore.value || !lastId.value || loadingMore.value) return
    loadingMore.value = true
    try {
      const nextData = await $fetch<PlatformPhotosResponse>('/api/platform/photos', {
        params: { lastId: lastId.value },
      })
      mergePhotos(nextData.photos)
      hasMore.value = nextData.hasMore
      lastId.value = nextData.lastId
    } finally {
      loadingMore.value = false
    }
  }

  async function loadSelectedPhotos(ids: string[]) {
    if (ids.length === 0) return
    requestedSelectedPhotoIds.value = [...new Set([...requestedSelectedPhotoIds.value, ...ids])]
    try {
      const nextData = await $fetch<PlatformPhotosResponse>('/api/platform/photos', {
        params: { ids: ids.join(',') },
      })
      if (nextData?.photos) mergePhotos(nextData.photos)
    } catch {
      requestedSelectedPhotoIds.value = requestedSelectedPhotoIds.value.filter(id => !ids.includes(id))
    }
  }

  watch(missingSelectedPhotoIds, (ids) => {
    if (ids.length === 0) return
    void loadSelectedPhotos(ids)
  }, { immediate: true })

  function getPhotoDisplayUrl(photo: PlatformPhotoItem): string {
    return photo.thumbnailUrl || photo.url
  }

  function getPhotoName(photo: PlatformPhotoItem): string {
    return photo.key.split('/').pop() || photo.key
  }

  function getSelectedPhotoName(id: string): string {
    const photo = photoById.value.get(id)
    return photo ? getPhotoName(photo) : id
  }

  return {
    photos,
    photoById,
    hasMore,
    loadingMore,
    loadMorePhotos,
    getPhotoDisplayUrl,
    getPhotoName,
    getSelectedPhotoName,
  }
}
