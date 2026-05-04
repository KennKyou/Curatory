<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useExhibitionPhotos } from '@/composables/useExhibitionPhotos'
import type {
  ExhibitionCoverProtection,
  ExhibitionSectionSettings,
  ExhibitionSectionLayout,
  ExhibitionTheme,
  PlatformPhotoItem,
} from '~~/server/types/api'

const { t } = useI18n()
const { form, saving, saved, loaded, load, save } = useSiteSettings()

definePageMeta({ layout: 'platform' })

if (!loaded.value) await load()

const exhibitionPickerOpen = ref(false)
const exhibitionSectionTypePickerOpen = ref(false)

const exhibitionSectionLayouts: ExhibitionSectionLayout[] = ['media', 'text']
const exhibitionThemes: ExhibitionTheme[] = ['white', 'black']
const exhibitionCoverProtections: ExhibitionCoverProtection[] = ['auto', 'none', 'soft', 'medium', 'strong']
const choiceActiveClass = 'border-primary bg-primary/10 text-foreground'
const choiceInactiveClass = 'border-border bg-background hover:bg-accent/40'
const segmentedGroupClass = 'grid rounded-lg border border-border bg-muted/40 p-1'
const segmentedButtonClass = 'min-w-0 rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const segmentedActiveClass = 'bg-background text-foreground shadow-sm'
const segmentedInactiveClass = 'text-muted-foreground hover:text-foreground'

const selectedPhotoIds = computed(() => {
  const ids = [
    form.value.exhibition.coverPhotoId,
    ...form.value.exhibition.sections.flatMap(section => section.photoIds),
  ].filter((id): id is string => Boolean(id))
  return [...new Set(ids)]
})
const {
  photos: exhibitionPhotos,
  photoById: exhibitionPhotoById,
  hasMore: exhibitionHasMore,
  loadingMore: exhibitionLoadingMore,
  loadMorePhotos: loadMoreExhibitionPhotos,
  getPhotoDisplayUrl,
  getPhotoName,
  getSelectedPhotoName,
} = useExhibitionPhotos(selectedPhotoIds)
const selectedExhibitionCoverPhoto = computed(() =>
  form.value.exhibition.coverPhotoId ? exhibitionPhotoById.value.get(form.value.exhibition.coverPhotoId) ?? null : null,
)
const selectedExhibitionSectionRows = computed(() =>
  form.value.exhibition.sections.map(section => ({
    section,
    photos: section.photoIds.map(id => ({ id, photo: exhibitionPhotoById.value.get(id) ?? null })),
  })),
)

function openExhibitionCoverPicker() {
  exhibitionPickerOpen.value = true
}

function selectExhibitionPhoto(id: string) {
  form.value.exhibition.coverPhotoId = id
  exhibitionPickerOpen.value = false
}

function clearExhibitionCover() {
  form.value.exhibition.coverPhotoId = null
}

function getExhibitionSectionLayoutLabel(layout: ExhibitionSectionLayout): string {
  return t(`settings.exhibitionLayout_${layout.replace('-', '_')}`)
}

function getExhibitionSectionLayoutDescription(layout: ExhibitionSectionLayout): string {
  return t(`settings.exhibitionLayoutDescription_${layout.replace('-', '_')}`)
}

function addExhibitionSection(layout: ExhibitionSectionLayout) {
  form.value.exhibition.sections.push({
    id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    layout,
    theme: 'white',
    title: '',
    body: '',
    photoIds: [],
    textPosition: layout === 'media' ? 'none' : 'none',
    desktopTextAlign: layout === 'text' ? 'center' : 'left',
    mobileTextAlign: layout === 'text' ? 'center' : 'left',
    reserveTextSpace: false,
  })
  exhibitionSectionTypePickerOpen.value = false
}

function removeExhibitionSection(index: number) {
  form.value.exhibition.sections.splice(index, 1)
}

function moveExhibitionSection(index: number, direction: -1 | 1) {
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= form.value.exhibition.sections.length) return
  const [section] = form.value.exhibition.sections.splice(index, 1)
  if (!section) return
  form.value.exhibition.sections.splice(targetIndex, 0, section)
}

function getExhibitionSectionEditPath(sectionId: string): string {
  return `/platform/exhibition/sections/${sectionId}`
}

function getExhibitionSectionSummary(section: ExhibitionSectionSettings, sectionPhotos: { id: string, photo: PlatformPhotoItem | null }[]): string {
  const title = section.title.trim()
  const body = section.body.trim()
  const textSummary = title || body || t('settings.exhibitionSectionUntitled')
  if (section.layout === 'text') return textSummary
  return `${textSummary} · ${sectionPhotos.length} ${t('settings.exhibitionSectionPhotoCount')}`
}
</script>

<template>
  <div class="space-y-6 py-8">
    <h1 class="mb-6 text-2xl font-bold">{{ t('settings.exhibitionPageTitle') }}</h1>

    <Card class="gap-4 p-4">
      <CardHeader class="p-0">
        <div class="flex items-center justify-between gap-4">
          <div class="space-y-1">
            <CardTitle class="text-base">{{ t('settings.exhibitionDetails') }}</CardTitle>
            <p class="text-sm text-muted-foreground">{{ t('settings.exhibitionDetailsHint') }}</p>
          </div>
          <Button data-test="settings-save" size="sm" :disabled="saving" @click="save">
            <Icon v-if="saved" icon="material-symbols:check" class="mr-1 h-4 w-4" />
            {{ saving ? t('settings.saving') : saved ? t('settings.saved') : t('settings.save') }}
          </Button>
        </div>
      </CardHeader>
      <CardContent class="space-y-4 p-0">
        <!-- Exhibition Selection -->
        <div data-test="exhibition-settings" class="space-y-5">
          <div class="space-y-4">
            <div data-test="exhibition-cover-row" class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex min-w-0 items-center gap-3">
                <img
                  v-if="selectedExhibitionCoverPhoto"
                  data-test="exhibition-selected-cover-preview"
                  :src="getPhotoDisplayUrl(selectedExhibitionCoverPhoto)"
                  :alt="selectedExhibitionCoverPhoto.key"
                  class="h-16 w-24 shrink-0 border border-border object-cover sm:h-16 sm:w-24"
                />
                <div class="min-w-0 space-y-0.5">
                  <p class="text-sm font-medium">{{ t('settings.exhibitionCoverPhoto') }}</p>
                  <p data-test="exhibition-selected-cover" class="truncate text-xs text-muted-foreground">
                    {{ form.exhibition.coverPhotoId ? getSelectedPhotoName(form.exhibition.coverPhotoId) : t('settings.exhibitionCoverAuto') }}
                  </p>
                </div>
              </div>
              <div data-test="exhibition-cover-actions" class="grid w-full shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:w-auto">
                <Button type="button" variant="outline" size="sm" data-test="exhibition-cover-open" class="min-w-0 truncate sm:w-auto" @click="openExhibitionCoverPicker">
                  <Icon icon="material-symbols:image-search" class="mr-1 h-4 w-4" />
                  {{ t('settings.choosePhoto') }}
                </Button>
                <Button
                  v-if="form.exhibition.coverPhotoId"
                  type="button"
                  variant="outline"
                  size="sm"
                  data-test="exhibition-cover-clear"
                  class="shrink-0"
                  @click="clearExhibitionCover"
                >
                  <Icon icon="material-symbols:close" class="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div class="grid gap-3 md:grid-cols-2">
              <div class="space-y-1.5">
                <Label for="exhibition-title">{{ t('settings.exhibitionTitle') }}</Label>
                <Input id="exhibition-title" v-model="form.exhibition.title" data-test="exhibition-title-input" class="text-sm" />
              </div>
              <div class="space-y-1.5">
                <Label for="exhibition-subtitle">{{ t('settings.exhibitionSubtitle') }}</Label>
                <Input id="exhibition-subtitle" v-model="form.exhibition.subtitle" data-test="exhibition-subtitle-input" class="text-sm" />
              </div>
              <div class="space-y-1.5 md:col-span-2">
                <Label for="exhibition-description">{{ t('settings.exhibitionDescription') }}</Label>
                <Textarea id="exhibition-description" v-model="form.exhibition.description" data-test="exhibition-description-input" class="text-sm" rows="3" />
              </div>
              <div class="space-y-1.5">
                <Label for="exhibition-start-date">{{ t('settings.exhibitionStartDate') }}</Label>
                <Input id="exhibition-start-date" v-model="form.exhibition.startDate" data-test="exhibition-start-date-input" type="date" class="date-input-light-icon text-sm" />
              </div>
              <div class="space-y-1.5">
                <Label for="exhibition-end-date">{{ t('settings.exhibitionEndDate') }}</Label>
                <Input id="exhibition-end-date" v-model="form.exhibition.endDate" data-test="exhibition-end-date-input" type="date" class="date-input-light-icon text-sm" />
              </div>
            </div>

            <div class="space-y-2">
              <Label>{{ t('settings.exhibitionTheme') }}</Label>
              <div :class="[segmentedGroupClass, 'grid-cols-2']">
                <button
                  v-for="theme in exhibitionThemes"
                  :key="theme"
                  type="button"
                  :data-test="`exhibition-theme-${theme}`"
                  :class="[segmentedButtonClass, form.exhibition.theme === theme ? segmentedActiveClass : segmentedInactiveClass]"
                  :aria-pressed="form.exhibition.theme === theme"
                  @click="form.exhibition.theme = theme"
                >
                  {{ theme === 'white' ? t('settings.exhibitionThemeWhite') : t('settings.exhibitionThemeBlack') }}
                </button>
              </div>
            </div>

            <div class="space-y-2">
              <Label>{{ t('settings.exhibitionCoverTextColor') }}</Label>
              <div :class="[segmentedGroupClass, 'grid-cols-2']">
                <button
                  type="button"
                  data-test="exhibition-cover-color-white"
                  :class="[segmentedButtonClass, form.exhibition.coverTextColor === 'white' ? segmentedActiveClass : segmentedInactiveClass]"
                  :aria-pressed="form.exhibition.coverTextColor === 'white'"
                  @click="form.exhibition.coverTextColor = 'white'"
                >
                  {{ t('settings.exhibitionColorWhite') }}
                </button>
                <button
                  type="button"
                  data-test="exhibition-cover-color-black"
                  :class="[segmentedButtonClass, form.exhibition.coverTextColor === 'black' ? segmentedActiveClass : segmentedInactiveClass]"
                  :aria-pressed="form.exhibition.coverTextColor === 'black'"
                  @click="form.exhibition.coverTextColor = 'black'"
                >
                  {{ t('settings.exhibitionColorBlack') }}
                </button>
              </div>
            </div>

            <div class="space-y-2">
              <Label>{{ t('settings.exhibitionCoverProtection') }}</Label>
              <div :class="[segmentedGroupClass, 'grid-cols-2 sm:grid-cols-5']">
                <button
                  v-for="protection in exhibitionCoverProtections"
                  :key="protection"
                  type="button"
                  :data-test="`exhibition-cover-protection-${protection}`"
                  :class="[segmentedButtonClass, form.exhibition.coverProtection === protection ? segmentedActiveClass : segmentedInactiveClass]"
                  :aria-pressed="form.exhibition.coverProtection === protection"
                  @click="form.exhibition.coverProtection = protection"
                >
                  {{ t(`settings.exhibitionCoverProtection_${protection}`) }}
                </button>
              </div>
              <p class="text-xs text-muted-foreground">{{ t('settings.exhibitionCoverProtectionHint') }}</p>
            </div>
          </div>

          <div class="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
            <div class="flex items-center justify-between gap-3">
              <div class="space-y-0.5">
                <p class="text-sm font-medium">{{ t('settings.exhibitionSections') }}</p>
                <p class="text-xs text-muted-foreground">{{ t('settings.exhibitionSectionsHint') }}</p>
              </div>
              <Button type="button" variant="outline" size="sm" data-test="exhibition-section-add" @click="exhibitionSectionTypePickerOpen = true">
                <Icon icon="material-symbols:add" class="mr-1 h-4 w-4" />
                {{ t('settings.exhibitionAddSection') }}
              </Button>
            </div>

            <div v-if="selectedExhibitionSectionRows.length === 0" data-test="exhibition-sections-empty" class="rounded-md border border-dashed border-border bg-background/70 px-4 py-6 text-center text-sm text-muted-foreground">
              {{ t('settings.exhibitionNoSections') }}
            </div>

            <div
              v-for="({ section, photos: sectionPhotos }, index) in selectedExhibitionSectionRows"
              :key="section.id"
              :data-test="`exhibition-section-row-${section.id}`"
              class="grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div class="min-w-0 space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-sm font-medium">{{ t('settings.exhibitionSectionNumber', { number: index + 1 }) }}</p>
                  <span class="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                    {{ getExhibitionSectionLayoutLabel(section.layout) }}
                  </span>
                </div>
                <p :data-test="`exhibition-section-summary-${index}`" class="truncate text-sm text-muted-foreground">
                  {{ getExhibitionSectionSummary(section, sectionPhotos) }}
                </p>
              </div>

              <div class="flex justify-end gap-2">
                <NuxtLink
                  :to="getExhibitionSectionEditPath(section.id)"
                  :data-test="`exhibition-section-edit-${index}`"
                  class="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon icon="material-symbols:edit-outline" class="mr-1 h-4 w-4" />
                  {{ t('settings.exhibitionSectionEdit') }}
                </NuxtLink>
                <Button type="button" variant="outline" size="sm" :data-test="`exhibition-section-up-${index}`" :disabled="index === 0" @click="moveExhibitionSection(index, -1)">
                  <Icon icon="material-symbols:arrow-upward" class="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  :data-test="`exhibition-section-down-${index}`"
                  :disabled="index === selectedExhibitionSectionRows.length - 1"
                  @click="moveExhibitionSection(index, 1)"
                >
                  <Icon icon="material-symbols:arrow-downward" class="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="sm" :data-test="`exhibition-section-remove-${index}`" @click="removeExhibitionSection(index)">
                  <Icon icon="material-symbols:delete-outline" class="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Dialog v-model:open="exhibitionSectionTypePickerOpen">
          <DialogContent v-if="exhibitionSectionTypePickerOpen" data-test="exhibition-section-type-picker" class="scrollbar-hide max-h-[82vh] w-[calc(100vw-2rem)] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{{ t('settings.exhibitionAddSection') }}</DialogTitle>
              <DialogDescription>{{ t('settings.exhibitionChooseSectionLayout') }}</DialogDescription>
            </DialogHeader>
            <div class="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <button
                v-for="layout in exhibitionSectionLayouts"
                :key="layout"
                type="button"
                :data-test="`exhibition-section-type-${layout}`"
                class="min-w-0 space-y-3 rounded-lg border px-3 py-3 text-left text-sm transition-colors"
                :class="choiceInactiveClass"
                @click="addExhibitionSection(layout)"
              >
                <div
                  :data-test="`exhibition-section-type-preview-${layout}`"
                  class="flex h-20 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 p-3 sm:h-24"
                  :class="layout === 'text' ? 'text-center' : ''"
                  aria-hidden="true"
                >
                  <div
                    v-if="layout === 'media'"
                    class="grid h-full w-full grid-cols-[1.25fr_1fr] items-center gap-2"
                  >
                    <div class="grid h-14 grid-cols-2 gap-1 rounded border border-muted-foreground/50 bg-background p-1 shadow-sm">
                      <div class="rounded bg-muted-foreground/25" />
                      <div class="rounded bg-muted-foreground/20" />
                    </div>
                    <div class="space-y-2">
                      <div class="h-2 w-4/5 rounded bg-muted-foreground/50" />
                      <div class="h-2 w-full rounded bg-muted-foreground/30" />
                      <div class="h-2 w-3/5 rounded bg-muted-foreground/30" />
                    </div>
                  </div>
                  <div
                    v-else-if="layout === 'text'"
                    class="w-full space-y-2 px-2"
                  >
                    <div class="mx-auto h-2 w-1/2 rounded bg-muted-foreground/50" />
                    <div class="mx-auto h-2 w-full rounded bg-muted-foreground/30" />
                    <div class="mx-auto h-2 w-11/12 rounded bg-muted-foreground/30" />
                    <div class="mx-auto h-2 w-3/4 rounded bg-muted-foreground/30" />
                  </div>
                </div>
                <div class="space-y-1">
                  <p class="font-medium">{{ getExhibitionSectionLayoutLabel(layout) }}</p>
                  <p class="text-xs font-normal leading-relaxed text-muted-foreground">
                    {{ getExhibitionSectionLayoutDescription(layout) }}
                  </p>
                </div>
              </button>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" @click="exhibitionSectionTypePickerOpen = false">
                {{ t('photoLibrary.cancel') }}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                :class="form.exhibition.coverPhotoId === photo.id ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/60'"
                :title="getPhotoName(photo)"
                @click="selectExhibitionPhoto(photo.id)"
              >
                <img :src="getPhotoDisplayUrl(photo)" :alt="photo.key" class="h-full w-full object-cover" />
                <span v-if="form.exhibition.coverPhotoId === photo.id" class="absolute right-1 top-1 bg-background/80 p-1 text-primary">
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

<style scoped>
.date-input-light-icon::-webkit-calendar-picker-indicator {
  filter: invert(1);
}
</style>
