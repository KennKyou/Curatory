<script setup lang="ts">
import { A11y, Keyboard, Mousewheel } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/vue'
import 'swiper/css'
import type { ExhibitionSettings } from '~~/server/types/api'
import type { ReactionEmojiKey } from '~~/server/utils/reactions/emojiSet'

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
  exif: Record<string, any> | null
  takenAt: string | null
  topReaction: ReactionEmojiKey | null
  reactionTotal: number
}

const props = defineProps<{
  photos: Photo[]
  exhibition: ExhibitionSettings
  exhibitionCoverPhoto: Photo | null
  exhibitionSectionPhotos: { id: string, photos: Photo[] }[]
}>()

const emit = defineEmits<{
  select: [payload: { photo: Photo, rect: DOMRect, mode?: 'expand' | 'fade' }]
}>()

const { t } = useI18n()
const swiperModules = [Mousewheel, Keyboard, A11y]
const desktopSwiperEnabled = ref(false)
const exhibitionActiveSlideIndex = useState('exhibitionActiveSlideIndex', () => 0)
const exhibitionPhotoButtonClass = 'group/exhibition-photo cursor-zoom-in'
const exhibitionPhotoHoverCueClass = 'pointer-events-none absolute left-1/2 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white opacity-0 shadow-sm backdrop-blur-md transition-opacity duration-150 motion-reduce:transition-none group-hover/exhibition-photo:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:block'

const sectionPhotoMap = computed(() =>
  new Map(props.exhibitionSectionPhotos.map(section => [section.id, section.photos])),
)
const hasExhibitionContent = computed(() =>
  Boolean(props.exhibitionCoverPhoto || props.exhibition.title || props.exhibition.sections.length > 0),
)
const dateRange = computed(() => {
  const { startDate, endDate } = props.exhibition
  const start = formatExhibitionDate(startDate)
  const end = formatExhibitionDate(endDate)
  if (start && end) return `${start} - ${end}`
  return start || end || ''
})
const exhibitionThemeClass = computed(() =>
  props.exhibition.theme === 'black' ? 'bg-zinc-950 text-white' : 'bg-white text-zinc-950',
)
const coverProtectionClass = computed(() => {
  const protection = props.exhibition.coverProtection === 'auto' ? 'medium' : props.exhibition.coverProtection
  const usesBlackText = props.exhibition.coverTextColor === 'black'
  if (protection === 'none') return 'bg-transparent'

  if (usesBlackText) {
    return {
      soft: 'bg-gradient-to-t from-white/45 via-white/15 to-white/30',
      medium: 'bg-gradient-to-t from-white/65 via-white/25 to-white/45',
      strong: 'bg-white/70',
    }[protection]
  }

  return {
    soft: 'bg-gradient-to-t from-black/45 via-black/10 to-black/25',
    medium: 'bg-gradient-to-t from-black/60 via-black/20 to-black/35',
    strong: 'bg-black/60',
  }[protection]
})
const coverCopyStyle = computed(() => {
  const protection = props.exhibition.coverProtection === 'auto' ? 'medium' : props.exhibition.coverProtection
  if (protection === 'none') return {}
  return props.exhibition.coverTextColor === 'black'
    ? { textShadow: '0 2px 18px rgba(255,255,255,.72), 0 1px 2px rgba(255,255,255,.65)' }
    : { textShadow: '0 2px 18px rgba(0,0,0,.58), 0 1px 2px rgba(0,0,0,.5)' }
})

onMounted(() => {
  if (!window.matchMedia) return

  const mediaQuery = window.matchMedia('(min-width: 1024px)')
  const updateMobileActiveSection = () => {
    if (mediaQuery.matches) return
    exhibitionActiveSlideIndex.value = window.scrollY < window.innerHeight * 0.6 ? 0 : 1
  }
  const updateMode = () => {
    desktopSwiperEnabled.value = mediaQuery.matches
    if (!mediaQuery.matches) updateMobileActiveSection()
  }

  mediaQuery.addEventListener('change', updateMode)
  window.addEventListener('scroll', updateMobileActiveSection, { passive: true })
  exhibitionActiveSlideIndex.value = 0
  updateMode()

  onUnmounted(() => {
    mediaQuery.removeEventListener('change', updateMode)
    window.removeEventListener('scroll', updateMobileActiveSection)
    exhibitionActiveSlideIndex.value = 0
  })
})

function formatExhibitionDate(value: string | null): string {
  if (!value) return ''
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return value
  const [, year, month, day] = match
  const monthName = [
    'Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.',
    'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.',
  ][Number(month) - 1]
  if (!monthName || !day) return value
  return `${monthName} ${Number(day)}, ${year}`
}

function getSectionPhotos(sectionId: string): Photo[] {
  return sectionPhotoMap.value.get(sectionId) ?? []
}

function sectionHasText(section: ExhibitionSettings['sections'][number]): boolean {
  return Boolean(section.title.trim() || section.body.trim())
}

function sectionShowsText(section: ExhibitionSettings['sections'][number]): boolean {
  if (section.layout === 'text') return sectionHasText(section)
  return section.textPosition !== 'none' && sectionHasText(section)
}

function sectionReservesTextSpace(section: ExhibitionSettings['sections'][number]): boolean {
  return section.layout === 'media'
    && (section.textPosition === 'left' || section.textPosition === 'right')
    && section.reserveTextSpace
}

function sectionHasSideTextArea(section: ExhibitionSettings['sections'][number]): boolean {
  return sectionShowsText(section) || sectionReservesTextSpace(section)
}

function sectionTextFirst(section: ExhibitionSettings['sections'][number]): boolean {
  return section.layout === 'text' || (section.layout === 'media' && section.textPosition === 'left')
}

function getDesktopSectionGridClass(section: ExhibitionSettings['sections'][number]): string {
  if (section.layout === 'text') return 'lg:grid-cols-1'
  if (!sectionHasSideTextArea(section) || section.textPosition === 'bottom') return 'lg:grid-cols-1'
  return section.textPosition === 'left'
    ? 'lg:grid-cols-[minmax(320px,0.75fr)_minmax(0,0.95fr)]'
    : 'lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.75fr)]'
}

function getSectionTextAlignClass(section: ExhibitionSettings['sections'][number], mode: 'mobile' | 'desktop'): string {
  const fallback = section.layout === 'text' ? 'center' : 'left'
  const align = mode === 'mobile'
    ? section.mobileTextAlign || fallback
    : section.desktopTextAlign || fallback
  return {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }[align]
}

function getDisplayUrl(photo: Photo): string {
  return photo.thumbnailUrl || photo.url
}

function getPhotoAspectRatio(photo: Photo): string {
  if (!photo.width || !photo.height) return '3 / 2'
  return `${photo.width} / ${photo.height}`
}

function getGalleryPhotoButtonSizeClass(photoCount: number, mode: 'mobile' | 'desktop'): string {
  if (photoCount > 2) {
    return mode === 'desktop' ? 'max-h-[38vh]' : 'max-h-[34vh]'
  }
  return mode === 'desktop' ? 'max-h-[80vh]' : 'max-h-[70vh]'
}

function getFullUrl(photo: Photo): string {
  return photo.url
}

function getPlaceholderUrl(photo: Photo): string | null {
  return photo.blurDataUrl || photo.thumbnailUrl
}

function fallbackRect(): DOMRect {
  return { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0, toJSON: () => ({}) } as DOMRect
}

function emitSelect(photo: Photo, event: MouseEvent) {
  const target = event.currentTarget as HTMLElement | null
  const img = target?.querySelector('img')
  const rect = img?.getBoundingClientRect() ?? target?.getBoundingClientRect() ?? fallbackRect()
  emit('select', { photo, rect, mode: 'fade' })
}

function getExhibitionPhotoCueLabel(): string {
  return t('exhibition.viewDetails')
}

function handleDesktopSlideChange(swiper: { activeIndex?: number }) {
  exhibitionActiveSlideIndex.value = swiper.activeIndex ?? 0
}
</script>

<template>
  <section data-test="exhibition-layout" class="min-h-screen bg-background text-foreground">
    <div v-if="!hasExhibitionContent" data-test="exhibition-empty" class="flex min-h-[60vh] items-center justify-center px-6 text-center text-muted-foreground">
      {{ t('exhibition.noPhotos') }}
    </div>

    <template v-else>
      <div class="lg:hidden" data-test="exhibition-mobile-flow">
        <section data-test="exhibition-cover" class="relative flex min-h-screen items-center overflow-hidden" :class="exhibitionThemeClass">
          <button
            v-if="exhibitionCoverPhoto"
            type="button"
            data-test="exhibition-cover-photo"
            :class="[exhibitionPhotoButtonClass, 'absolute inset-0 block h-full w-full text-left']"
            @click="emitSelect(exhibitionCoverPhoto, $event)"
          >
            <img
              v-if="getPlaceholderUrl(exhibitionCoverPhoto)"
              :src="getPlaceholderUrl(exhibitionCoverPhoto)!"
              :alt="exhibitionCoverPhoto.key"
              class="absolute inset-0 h-full w-full scale-105 object-cover blur-2xl"
            />
            <img :src="getFullUrl(exhibitionCoverPhoto)" :alt="exhibitionCoverPhoto.key" class="relative h-full w-full object-cover" />
            <span data-test="exhibition-photo-hover-cue" :class="exhibitionPhotoHoverCueClass">{{ getExhibitionPhotoCueLabel() }}</span>
          </button>
          <div v-else class="absolute inset-0" :class="exhibitionThemeClass" />
          <div class="absolute inset-0" :class="coverProtectionClass" />
          <div
            data-test="exhibition-cover-copy"
            class="relative z-10 mx-auto w-full max-w-5xl px-6 py-20 text-center sm:px-10"
            :class="exhibition.coverTextColor === 'black' ? 'text-black' : 'text-white'"
            :style="coverCopyStyle"
          >
            <p v-if="dateRange" class="text-xs font-medium uppercase tracking-[0.3em] opacity-70">{{ dateRange }}</p>
            <h1 v-if="exhibition.title" class="mt-4 text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">{{ exhibition.title }}</h1>
            <p v-if="exhibition.subtitle" class="mt-4 text-base leading-7 opacity-85 sm:text-lg">{{ exhibition.subtitle }}</p>
            <p v-if="exhibition.description" class="mx-auto mt-5 max-w-2xl text-sm leading-7 opacity-80">{{ exhibition.description }}</p>
          </div>
        </section>

        <section
          v-for="section in exhibition.sections"
          :key="section.id"
          :data-test="`exhibition-section-${section.id}`"
          class="flex flex-col justify-center overflow-hidden px-6 py-12 sm:px-12"
          :class="exhibitionThemeClass"
        >
          <div
            class="mx-auto grid w-full max-w-full items-center gap-8"
            :class="section.layout === 'text' ? '' : 'grid-cols-1'"
          >
            <div
              v-if="sectionTextFirst(section) && sectionShowsText(section)"
              data-test="exhibition-text"
              class="w-full max-w-full space-y-5"
              :class="[getSectionTextAlignClass(section, 'mobile'), section.layout === 'text' ? 'mx-auto' : '']"
            >
              <h2 v-if="section.title" class="text-xl font-semibold leading-tight">{{ section.title }}</h2>
              <p v-if="section.body" data-test="exhibition-body" class="whitespace-pre-line text-sm leading-6 opacity-80">{{ section.body }}</p>
            </div>

            <div v-if="section.layout === 'media' && getSectionPhotos(section.id).length === 1" class="grid min-h-0 place-items-center">
              <button
                v-if="getSectionPhotos(section.id)[0]"
                type="button"
                data-test="exhibition-photo-button"
                :class="[exhibitionPhotoButtonClass, 'relative inline-flex max-h-[70vh] max-w-full overflow-hidden text-left']"
                :style="{ aspectRatio: getPhotoAspectRatio(getSectionPhotos(section.id)[0]) }"
                @click="emitSelect(getSectionPhotos(section.id)[0], $event)"
              >
                <img :src="getDisplayUrl(getSectionPhotos(section.id)[0])" :alt="getSectionPhotos(section.id)[0].key" class="block h-full w-full object-contain" />
                <span data-test="exhibition-photo-hover-cue" :class="exhibitionPhotoHoverCueClass">{{ getExhibitionPhotoCueLabel() }}</span>
              </button>
            </div>

            <div v-if="section.layout === 'media' && getSectionPhotos(section.id).length > 1" data-test="exhibition-gallery-images" class="grid grid-cols-2 place-items-center gap-3 sm:gap-4">
              <button
                v-for="photo in getSectionPhotos(section.id).slice(0, 4)"
                :key="photo.id"
                type="button"
                data-test="exhibition-photo-button"
                :class="[exhibitionPhotoButtonClass, 'relative inline-flex max-w-full overflow-hidden text-left', getGalleryPhotoButtonSizeClass(getSectionPhotos(section.id).length, 'mobile')]"
                :style="{ aspectRatio: getPhotoAspectRatio(photo) }"
                @click="emitSelect(photo, $event)"
              >
                <img :src="getDisplayUrl(photo)" :alt="photo.key" class="block h-full w-full object-contain" />
                <span data-test="exhibition-photo-hover-cue" :class="exhibitionPhotoHoverCueClass">{{ getExhibitionPhotoCueLabel() }}</span>
              </button>
            </div>

            <div
              v-if="!sectionTextFirst(section) && sectionShowsText(section)"
              data-test="exhibition-text"
              class="w-full max-w-full space-y-5"
              :class="[getSectionTextAlignClass(section, 'mobile'), section.layout === 'text' ? 'mx-auto' : '']"
            >
              <h2 v-if="section.title" class="text-xl font-semibold leading-tight">{{ section.title }}</h2>
              <p v-if="section.body" data-test="exhibition-body" class="whitespace-pre-line text-sm leading-6 opacity-80">{{ section.body }}</p>
            </div>
          </div>
        </section>
      </div>

      <Swiper
        v-if="desktopSwiperEnabled"
      :modules="swiperModules"
      :slides-per-view="1"
      :speed="650"
      :mousewheel="{ forceToAxis: false, releaseOnEdges: true, thresholdDelta: 12 }"
      :keyboard="{ enabled: true }"
      class="hidden h-screen w-full lg:block"
      data-test="exhibition-swiper"
      @slide-change="handleDesktopSlideChange"
    >
      <SwiperSlide>
        <section data-test="exhibition-cover" class="relative flex min-h-screen items-center overflow-hidden" :class="exhibitionThemeClass">
          <button
            v-if="exhibitionCoverPhoto"
            type="button"
            data-test="exhibition-cover-photo"
            :class="[exhibitionPhotoButtonClass, 'absolute inset-0 block h-full w-full text-left']"
            @click="emitSelect(exhibitionCoverPhoto, $event)"
          >
            <img
              v-if="getPlaceholderUrl(exhibitionCoverPhoto)"
              :src="getPlaceholderUrl(exhibitionCoverPhoto)!"
              :alt="exhibitionCoverPhoto.key"
              class="absolute inset-0 h-full w-full scale-105 object-cover blur-2xl"
            />
            <img :src="getFullUrl(exhibitionCoverPhoto)" :alt="exhibitionCoverPhoto.key" class="relative h-full w-full object-cover" />
            <span data-test="exhibition-photo-hover-cue" :class="exhibitionPhotoHoverCueClass">{{ getExhibitionPhotoCueLabel() }}</span>
          </button>
          <div v-else class="absolute inset-0" :class="exhibitionThemeClass" />
          <div class="absolute inset-0" :class="coverProtectionClass" />
          <div
            data-test="exhibition-cover-copy"
            class="relative z-10 mx-auto w-full max-w-5xl px-6 py-20 text-center sm:px-10"
            :class="exhibition.coverTextColor === 'black' ? 'text-black' : 'text-white'"
            :style="coverCopyStyle"
          >
            <p v-if="dateRange" class="text-xs font-medium uppercase tracking-[0.3em] opacity-70">{{ dateRange }}</p>
            <h1 v-if="exhibition.title" class="mt-4 text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">{{ exhibition.title }}</h1>
            <p v-if="exhibition.subtitle" class="mt-4 text-base leading-7 opacity-85 sm:text-lg">{{ exhibition.subtitle }}</p>
            <p v-if="exhibition.description" class="mx-auto mt-5 max-w-2xl text-sm leading-7 opacity-80">{{ exhibition.description }}</p>
          </div>
        </section>
      </SwiperSlide>

      <SwiperSlide
        v-for="section in exhibition.sections"
        :key="section.id"
      >
        <section
          :data-test="`exhibition-section-${section.id}`"
          class="flex min-h-screen flex-col justify-center overflow-hidden px-6 py-14 sm:px-12 lg:px-16 lg:py-20"
          :class="exhibitionThemeClass"
        >
          <div
            class="mx-auto grid h-[80vh] w-full max-w-full items-center gap-8 lg:gap-12"
            :class="getDesktopSectionGridClass(section)"
          >
            <div
              v-if="sectionTextFirst(section) && sectionShowsText(section)"
              data-test="exhibition-text"
              class="w-full max-w-full space-y-5"
              :class="[getSectionTextAlignClass(section, 'desktop'), section.layout === 'text' ? 'mx-auto' : '']"
            >
              <h2 v-if="section.title" class="text-xl font-semibold leading-tight">{{ section.title }}</h2>
              <p v-if="section.body" data-test="exhibition-body" class="whitespace-pre-line text-sm leading-6 opacity-80">{{ section.body }}</p>
            </div>

            <div v-else-if="sectionTextFirst(section) && sectionReservesTextSpace(section)" data-test="exhibition-reserved-text-space" />

            <div v-if="section.layout === 'media' && getSectionPhotos(section.id).length === 1" class="grid h-full min-h-0 place-items-center">
              <button
                v-if="getSectionPhotos(section.id)[0]"
                type="button"
                data-test="exhibition-photo-button"
                :class="[exhibitionPhotoButtonClass, 'relative inline-flex h-full max-h-[80vh] max-w-full overflow-hidden text-left']"
                :style="{ aspectRatio: getPhotoAspectRatio(getSectionPhotos(section.id)[0]) }"
                @click="emitSelect(getSectionPhotos(section.id)[0], $event)"
              >
                <img :src="getDisplayUrl(getSectionPhotos(section.id)[0])" :alt="getSectionPhotos(section.id)[0].key" class="block h-full w-full object-contain" />
                <span data-test="exhibition-photo-hover-cue" :class="exhibitionPhotoHoverCueClass">{{ getExhibitionPhotoCueLabel() }}</span>
              </button>
            </div>

            <div
              v-if="section.layout === 'media' && getSectionPhotos(section.id).length > 1"
              data-test="exhibition-gallery-images"
              class="grid h-full min-h-0 grid-cols-2 place-items-center gap-4"
              :class="sectionHasSideTextArea(section) ? '' : 'mx-auto'"
            >
              <button
                v-for="photo in getSectionPhotos(section.id).slice(0, 4)"
                :key="photo.id"
                type="button"
                data-test="exhibition-photo-button"
                :class="[exhibitionPhotoButtonClass, 'relative inline-flex max-w-full overflow-hidden text-left', getGalleryPhotoButtonSizeClass(getSectionPhotos(section.id).length, 'desktop')]"
                :style="{ aspectRatio: getPhotoAspectRatio(photo) }"
                @click="emitSelect(photo, $event)"
              >
                <img :src="getDisplayUrl(photo)" :alt="photo.key" class="block h-full w-full object-contain" />
                <span data-test="exhibition-photo-hover-cue" :class="exhibitionPhotoHoverCueClass">{{ getExhibitionPhotoCueLabel() }}</span>
              </button>
            </div>

            <div
              v-if="!sectionTextFirst(section) && sectionShowsText(section)"
              data-test="exhibition-text"
              class="w-full max-w-full space-y-5"
              :class="[getSectionTextAlignClass(section, 'desktop'), section.textPosition === 'bottom' ? 'mx-auto' : '']"
            >
              <h2 v-if="section.title" class="text-xl font-semibold leading-tight">{{ section.title }}</h2>
              <p v-if="section.body" data-test="exhibition-body" class="whitespace-pre-line text-sm leading-6 opacity-80">{{ section.body }}</p>
            </div>

            <div v-else-if="!sectionTextFirst(section) && sectionReservesTextSpace(section)" data-test="exhibition-reserved-text-space" />
          </div>
        </section>
      </SwiperSlide>
      </Swiper>
    </template>
  </section>
</template>
