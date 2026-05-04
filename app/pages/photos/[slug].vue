<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const slug = route.params.slug as string
const requestFetch = useRequestFetch()

const { data: photo, error } = await useAsyncData(`photo-${slug}`, () =>
  requestFetch(`/api/photos/${slug}`),
)

if (error.value || !photo.value) {
  throw createError({ statusCode: 404, message: t('photoPermalink.notFound') })
}

const filename = photo.value.key.split('/').pop() || photo.value.key

useHead({
  title: filename,
  meta: [
    { property: 'og:image', content: `/api/og/photos/${slug}` },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:title', content: filename },
    { property: 'og:type', content: 'article' },
  ],
})

const showLightbox = ref(false)
const fadeRect = ref<DOMRect | null>(null)

onMounted(() => {
  const w = window.innerWidth * 0.6
  const h = window.innerHeight * 0.6
  const x = (window.innerWidth - w) / 2
  const y = (window.innerHeight - h) / 2
  fadeRect.value = new DOMRect(x, y, w, h)
  showLightbox.value = true
})

function onClose() {
  navigateTo('/')
}
</script>

<template>
  <div class="min-h-screen bg-background">
    <PhotoLightbox
      v-if="showLightbox && fadeRect"
      :photos="[photo!]"
      :initial-index="0"
      :rect="fadeRect"
      mode="fade"
      @close="onClose"
    />
  </div>
</template>
