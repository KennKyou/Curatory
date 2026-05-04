<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'vue-sonner'

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

const selectedIds = ref<Set<string>>(new Set())
const photos = ref<Photo[]>([])
const hasMore = ref(false)
const lastId = ref<string | null>(null)
const loading = ref(false)

const showDeletePhotos = ref(false)
const UPLOAD_MAX_FILE_SIZE = 20 * 1024 * 1024
const UPLOAD_MAX_FILE_COUNT = 20
const uploading = ref(false)
const showUpload = ref(false)
const uploadFiles = ref<File[]>([])
const uploadCurrent = ref(0)
const uploadTotal = ref(0)
const uploadErrors = ref<string[]>([])
const fileInput = ref<HTMLInputElement | null>(null)

async function fetchPhotos(append = false) {
  if (loading.value) return
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (append && lastId.value) params.lastId = lastId.value

    const data = await $fetch<{ photos: Photo[]; hasMore: boolean; lastId: string | null }>('/api/platform/photos', { params })

    photos.value = append ? [...photos.value, ...data.photos] : data.photos
    hasMore.value = data.hasMore
    lastId.value = data.lastId
  } catch {
    if (!append) photos.value = []
  } finally {
    loading.value = false
  }
}

function loadMore() {
  fetchPhotos(true)
}

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedIds.value = next
}

function openDeletePhotos() {
  showDeletePhotos.value = true
}

async function submitDeletePhotos() {
  try {
    const ids = [...selectedIds.value]
    const data = await $fetch<{ deleted: number }>('/api/platform/photos', {
      method: 'DELETE',
      body: { ids },
    })
    showDeletePhotos.value = false
    selectedIds.value = new Set()
    toast.success(t('photoLibrary.deleteComplete', { n: data.deleted }))
    await fetchPhotos()
  } catch {
    toast.error(t('photoLibrary.deleteFailed'))
  }
}

function openUpload() {
  uploadFiles.value = []
  uploadErrors.value = []
  showUpload.value = true
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  const { toAdd, oversized, droppedByCount } = partitionUploadFiles(
    Array.from(input.files),
    uploadFiles.value.length,
    UPLOAD_MAX_FILE_SIZE,
    UPLOAD_MAX_FILE_COUNT,
  )

  if (toAdd.length > 0) {
    uploadFiles.value = [...uploadFiles.value, ...toAdd]
  }

  for (const file of oversized) {
    toast.error(t('photoLibrary.uploadFileTooLarge', {
      filename: file.name,
      maxSize: formatFileSize(UPLOAD_MAX_FILE_SIZE),
    }))
  }

  if (droppedByCount > 0) {
    toast.error(t('photoLibrary.uploadTooManyFiles', { maxCount: UPLOAD_MAX_FILE_COUNT }))
  }

  input.value = ''
}

function removeUploadFile(index: number) {
  uploadFiles.value = uploadFiles.value.filter((_, i) => i !== index)
}

async function submitUpload() {
  if (uploadFiles.value.length === 0) return

  uploading.value = true
  uploadCurrent.value = 0
  uploadTotal.value = uploadFiles.value.length
  uploadErrors.value = []

  let successCount = 0

  for (const file of uploadFiles.value) {
    uploadCurrent.value++
    try {
      const formData = new FormData()
      formData.append('files', file)

      await $fetch('/api/platform/photos', {
        method: 'POST',
        body: formData,
      })
      successCount++
    } catch (err) {
      if (classifyUploadError(err) === 'too-large') {
        toast.error(t('photoLibrary.uploadFileTooLargeError', { filename: file.name }))
      } else {
        uploadErrors.value.push(file.name)
      }
    }
  }

  showUpload.value = false
  uploadFiles.value = []
  uploading.value = false

  if (successCount > 0) {
    toast.success(t('photoLibrary.uploadComplete', { n: successCount }))
  }
  if (uploadErrors.value.length > 0) {
    toast.error(t('photoLibrary.uploadPartialFail', { files: uploadErrors.value.join(', ') }))
  }

  await fetchPhotos()
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const selectedPhotos = computed(() =>
  photos.value.filter(p => selectedIds.value.has(p.id)),
)

function onSheetClose() {
  selectedIds.value = new Set()
}

fetchPhotos()
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-2">
      <Button size="sm" @click="openUpload">
        <Icon icon="material-symbols:upload" class="mr-1 h-4 w-4" />
        {{ t('photoLibrary.upload') }}
      </Button>

      <input
        ref="fileInput"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/gif,image/webp"
        class="hidden"
        @change="handleFileSelect"
      />
    </div>

    <PhotoGrid
      :photos="photos"
      :selected-ids="selectedIds"
      :has-more="hasMore"
      :loading="loading"
      @load-more="loadMore"
      @toggle-select="toggleSelect"
    />

    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      enter-from-class="translate-y-full"
      enter-to-class="translate-y-0"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-from-class="translate-y-0"
      leave-to-class="translate-y-full"
    >
      <PhotoDetailSheet
        v-if="selectedIds.size > 0"
        :selected-photos="selectedPhotos"
        :selected-ids="selectedIds"
        @close="onSheetClose"
        @delete="openDeletePhotos"
      />
    </Transition>

    <Dialog v-model:open="showDeletePhotos">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t('photoLibrary.confirmDelete') }}</DialogTitle>
          <DialogDescription>{{ t('photoLibrary.confirmDeletePhotos', { n: selectedIds.size }) }}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="showDeletePhotos = false">{{ t('photoLibrary.cancel') }}</Button>
          <Button variant="destructive" @click="submitDeletePhotos">{{ t('photoLibrary.delete') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showUpload">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>{{ t('photoLibrary.upload') }}</DialogTitle>
        </DialogHeader>
        <div class="grid gap-4 py-2">
          <div class="grid gap-2">
            <label class="text-sm font-medium">{{ t('photoLibrary.selectFiles') }}</label>
            <Button variant="outline" size="sm" @click="fileInput?.click()">
              <Icon icon="material-symbols:add-photo-alternate-outline" class="mr-1 h-4 w-4" />
              {{ t('photoLibrary.addFiles') }}
            </Button>
            <p class="text-xs text-muted-foreground">
              {{ t('photoLibrary.uploadSizeHint', { maxSize: formatFileSize(UPLOAD_MAX_FILE_SIZE), maxCount: UPLOAD_MAX_FILE_COUNT }) }}
            </p>
            <input
              ref="fileInput"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp"
              class="hidden"
              @change="handleFileSelect"
            />
          </div>

          <div v-if="uploadFiles.length > 0" class="grid max-h-48 gap-1.5 overflow-y-auto">
            <div
              v-for="(file, i) in uploadFiles"
              :key="i"
              class="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-sm"
            >
              <span class="min-w-0 flex-1 truncate">{{ file.name }}</span>
              <span class="shrink-0 text-xs text-muted-foreground">{{ formatFileSize(file.size) }}</span>
              <button class="shrink-0 text-muted-foreground hover:text-destructive" @click="removeUploadFile(i)">
                <Icon icon="material-symbols:close" class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showUpload = false">{{ t('photoLibrary.cancel') }}</Button>
          <Button :disabled="uploadFiles.length === 0 || uploading" @click="submitUpload">
            <Icon v-if="uploading" icon="material-symbols:progress-activity" class="mr-1 h-4 w-4 animate-spin" />
            {{ uploading ? t('photoLibrary.uploadProgress', { current: uploadCurrent, total: uploadTotal }) : t('photoLibrary.uploadCount', { n: uploadFiles.length }) }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
