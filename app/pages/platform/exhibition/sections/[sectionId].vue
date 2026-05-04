<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { useExhibitionPhotos } from '@/composables/useExhibitionPhotos'
import type { ExhibitionSectionSettings, ExhibitionSectionTextAlign, ExhibitionSectionTextPosition } from '~~/server/types/api'

const { t } = useI18n()
const route = useRoute()
const { form, saving, saved, loaded, load, save } = useSiteSettings()

definePageMeta({ layout: 'platform' })

if (!loaded.value) await load()

const sectionId = computed(() => String(route.params.sectionId || ''))
const sectionIndex = computed(() => form.value.exhibition.sections.findIndex(section => section.id === sectionId.value))
const section = computed(() => sectionIndex.value >= 0 ? form.value.exhibition.sections[sectionIndex.value] : null)
const originalSection = ref<ExhibitionSectionSettings | null>(section.value ? cloneSection(section.value) : null)
const selectedPhotoIds = computed(() => section.value?.photoIds ?? [])
const {
  photos: exhibitionPhotos,
  photoById: exhibitionPhotoById,
  hasMore: exhibitionHasMore,
  loadingMore: exhibitionLoadingMore,
  loadMorePhotos: loadMoreExhibitionPhotos,
  getPhotoDisplayUrl,
  getPhotoName,
} = useExhibitionPhotos(selectedPhotoIds)

const exhibitionPickerOpen = ref(false)
const exhibitionPickerSlotIndex = ref(0)
const exhibitionTextPositions: ExhibitionSectionTextPosition[] = ['none', 'left', 'right', 'bottom']
const exhibitionTextAligns: ExhibitionSectionTextAlign[] = ['left', 'center', 'right']
const segmentedGroupClass = 'grid rounded-lg border border-border bg-muted/40 p-1'
const segmentedButtonClass = 'min-w-0 rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const segmentedActiveClass = 'bg-background text-foreground shadow-sm'
const segmentedInactiveClass = 'text-muted-foreground hover:text-foreground'

const selectedSectionPhotos = computed(() =>
  (section.value?.photoIds ?? []).map(id => ({ id, photo: exhibitionPhotoById.value.get(id) ?? null })),
)

function cloneSection(value: ExhibitionSectionSettings): ExhibitionSectionSettings {
  return {
    ...value,
    photoIds: [...value.photoIds],
  }
}

function cancelSectionEdit() {
  if (sectionIndex.value >= 0 && originalSection.value) {
    form.value.exhibition.sections[sectionIndex.value] = cloneSection(originalSection.value)
  }
  navigateTo('/platform/exhibition')
}

function getExhibitionSectionPhotoSlotCount(photoCount: number): number {
  return Math.min(4, Math.max(1, photoCount + 1))
}

function openExhibitionSectionPicker(slotIndex = 0) {
  exhibitionPickerSlotIndex.value = slotIndex
  exhibitionPickerOpen.value = true
}

function selectExhibitionPhoto(id: string) {
  if (!section.value) return
  const nextPhotoIds = [...section.value.photoIds]
  nextPhotoIds[exhibitionPickerSlotIndex.value] = id
  section.value.photoIds = nextPhotoIds.filter(Boolean)
  exhibitionPickerOpen.value = false
}

function removeExhibitionSectionPhoto(slotIndex = 0) {
  if (!section.value) return
  section.value.photoIds = section.value.photoIds.filter((_, index) => index !== slotIndex)
}
</script>

<template>
  <div class="space-y-6">
    <Card class="gap-4 p-4">
      <CardHeader class="p-0">
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0 space-y-1">
            <NuxtLink to="/platform/exhibition" class="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
              <Icon icon="material-symbols:arrow-back" class="mr-1 h-4 w-4" />
              {{ t('settings.exhibitionSectionBackToList') }}
            </NuxtLink>
            <CardTitle class="truncate text-base">
              {{ section ? t('settings.exhibitionSectionDetail') : t('settings.exhibitionSectionMissingTitle') }}
            </CardTitle>
            <p class="text-sm text-muted-foreground">
              {{ section ? t('settings.exhibitionSectionDetailHint') : t('settings.exhibitionSectionMissingHint') }}
            </p>
          </div>
          <div v-if="section" class="flex shrink-0 items-center gap-2">
            <Button data-test="exhibition-section-cancel" type="button" variant="outline" size="sm" @click="cancelSectionEdit">
              {{ t('photoLibrary.cancel') }}
            </Button>
            <Button data-test="settings-save" size="sm" :disabled="saving" @click="save">
              <Icon v-if="saved" icon="material-symbols:check" class="mr-1 h-4 w-4" />
              {{ saving ? t('settings.saving') : saved ? t('settings.saved') : t('settings.save') }}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent class="space-y-4 p-0">
        <div v-if="!section" data-test="exhibition-section-missing" class="rounded-md border border-dashed border-border bg-background/70 px-4 py-6 text-center text-sm text-muted-foreground">
          {{ t('settings.exhibitionSectionMissingHint') }}
        </div>

        <div v-else data-test="exhibition-section-detail" class="space-y-4">
          <div class="rounded-lg border border-border bg-muted/20 p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="space-y-0.5">
                <p class="text-sm font-medium">{{ t('settings.exhibitionSectionLayout') }}</p>
                <p class="text-xs text-muted-foreground">{{ t('settings.exhibitionSectionFixedLayout') }}</p>
              </div>
              <span class="rounded-md border border-border bg-background px-3 py-1 text-sm">
                {{ t(`settings.exhibitionLayout_${section.layout}`) }}
              </span>
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <div class="space-y-1.5">
              <Label for="exhibition-section-title">{{ t('settings.exhibitionSectionTitle') }}</Label>
              <Input id="exhibition-section-title" v-model="section.title" data-test="exhibition-section-title" class="text-sm" />
            </div>
            <div class="space-y-1.5 md:col-span-2">
              <Label for="exhibition-section-body">{{ t('settings.exhibitionSectionBody') }}</Label>
              <Textarea id="exhibition-section-body" v-model="section.body" data-test="exhibition-section-body" class="text-sm" rows="5" />
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <div class="space-y-1.5">
              <Label>{{ t('settings.exhibitionDesktopTextAlign') }}</Label>
              <div :class="[segmentedGroupClass, 'grid-cols-3']">
                <button
                  v-for="align in exhibitionTextAligns"
                  :key="align"
                  type="button"
                  :data-test="`exhibition-section-desktop-text-align-${align}`"
                  :class="[segmentedButtonClass, section.desktopTextAlign === align ? segmentedActiveClass : segmentedInactiveClass]"
                  :aria-pressed="section.desktopTextAlign === align"
                  @click="section.desktopTextAlign = align"
                >
                  {{ t(`settings.exhibitionTextAlign_${align}`) }}
                </button>
              </div>
            </div>
            <div class="space-y-1.5">
              <Label>{{ t('settings.exhibitionMobileTextAlign') }}</Label>
              <div :class="[segmentedGroupClass, 'grid-cols-3']">
                <button
                  v-for="align in exhibitionTextAligns"
                  :key="align"
                  type="button"
                  :data-test="`exhibition-section-mobile-text-align-${align}`"
                  :class="[segmentedButtonClass, section.mobileTextAlign === align ? segmentedActiveClass : segmentedInactiveClass]"
                  :aria-pressed="section.mobileTextAlign === align"
                  @click="section.mobileTextAlign = align"
                >
                  {{ t(`settings.exhibitionTextAlign_${align}`) }}
                </button>
              </div>
            </div>
          </div>

          <div v-if="section.layout === 'media'" class="space-y-4">
            <div class="grid gap-3 md:grid-cols-2">
              <div class="space-y-1.5">
                <Label>{{ t('settings.exhibitionSectionTextPosition') }}</Label>
                <div :class="[segmentedGroupClass, 'grid-cols-2 sm:grid-cols-4']">
                  <button
                    v-for="position in exhibitionTextPositions"
                    :key="position"
                    type="button"
                    :data-test="`exhibition-section-text-position-${position}`"
                    :class="[segmentedButtonClass, section.textPosition === position ? segmentedActiveClass : segmentedInactiveClass]"
                    :aria-pressed="section.textPosition === position"
                    @click="section.textPosition = position"
                  >
                    {{ t(`settings.exhibitionTextPosition_${position}`) }}
                  </button>
                </div>
              </div>
              <div v-if="section.textPosition === 'left' || section.textPosition === 'right'" class="space-y-1.5">
                <Label>{{ t('settings.exhibitionReserveTextSpace') }}</Label>
                <div class="flex min-h-10 items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
                  <p class="text-xs text-muted-foreground">{{ t('settings.exhibitionReserveTextSpaceHint') }}</p>
                  <Switch v-model="section.reserveTextSpace" data-test="exhibition-section-reserve-text-space" />
                </div>
              </div>
            </div>

            <div class="space-y-2">
              <p class="text-sm font-medium">{{ t('settings.exhibitionSectionPhotos') }}</p>
              <div
                v-for="slotIndex in getExhibitionSectionPhotoSlotCount(selectedSectionPhotos.length)"
                :key="slotIndex"
                class="space-y-2 rounded-md border border-border bg-background p-3"
              >
                <div class="flex items-center justify-between gap-3">
                  <Label>{{ t('settings.exhibitionSectionPhotoSlot', { number: slotIndex }) }}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    :data-test="`exhibition-section-photo-open-${slotIndex - 1}`"
                    @click="openExhibitionSectionPicker(slotIndex - 1)"
                  >
                    <Icon icon="material-symbols:add-photo-alternate-outline" class="mr-1 h-4 w-4" />
                    {{ selectedSectionPhotos[slotIndex - 1]?.id ? t('settings.exhibitionReplacePhoto') : t('settings.choosePhoto') }}
                  </Button>
                </div>
                <div
                  v-if="selectedSectionPhotos[slotIndex - 1]?.id"
                  :data-test="`exhibition-section-selected-photo-${selectedSectionPhotos[slotIndex - 1]?.id}`"
                  class="flex items-center gap-3 border border-border bg-background p-2"
                >
                  <img v-if="selectedSectionPhotos[slotIndex - 1]?.photo" :src="getPhotoDisplayUrl(selectedSectionPhotos[slotIndex - 1].photo!)" :alt="selectedSectionPhotos[slotIndex - 1].photo!.key" class="h-12 w-12 shrink-0 object-cover" />
                  <div v-else class="h-12 w-12 shrink-0 bg-accent/20" />
                  <span class="min-w-0 flex-1 truncate text-sm">{{ selectedSectionPhotos[slotIndex - 1]?.photo ? getPhotoName(selectedSectionPhotos[slotIndex - 1].photo!) : selectedSectionPhotos[slotIndex - 1]?.id }}</span>
                  <Button type="button" variant="outline" size="sm" @click="removeExhibitionSectionPhoto(slotIndex - 1)">
                    <Icon icon="material-symbols:close" class="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Dialog v-model:open="exhibitionPickerOpen">
          <DialogContent v-if="exhibitionPickerOpen" data-test="exhibition-picker-content" class="scrollbar-hide max-h-[82vh] w-[calc(100vw-2rem)] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{{ t('settings.exhibitionPhotoPicker') }}</DialogTitle>
              <DialogDescription>{{ t('settings.exhibitionPhotoPickerHint') }}</DialogDescription>
            </DialogHeader>
            <div class="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
              <button
                v-for="photo in exhibitionPhotos"
                :key="photo.id"
                type="button"
                :data-test="`exhibition-photo-option-${photo.id}`"
                class="relative aspect-square overflow-hidden border bg-accent/10"
                :class="section?.photoIds[exhibitionPickerSlotIndex] === photo.id ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/60'"
                :title="getPhotoName(photo)"
                @click="selectExhibitionPhoto(photo.id)"
              >
                <img :src="getPhotoDisplayUrl(photo)" :alt="photo.key" class="h-full w-full object-cover" />
                <span v-if="section?.photoIds[exhibitionPickerSlotIndex] === photo.id" class="absolute right-1 top-1 bg-background/80 p-1 text-primary">
                  <Icon icon="material-symbols:check" class="h-4 w-4" />
                </span>
              </button>
            </div>
            <div v-if="exhibitionHasMore" class="flex justify-center pt-4">
              <Button
                type="button"
                variant="outline"
                data-test="exhibition-picker-load-more"
                :disabled="exhibitionLoadingMore"
                @click="loadMoreExhibitionPhotos"
              >
                {{ exhibitionLoadingMore ? t('settings.loadingMorePhotos') : t('settings.loadMorePhotos') }}
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" @click="exhibitionPickerOpen = false">
                {{ t('photoLibrary.cancel') }}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  </div>
</template>
