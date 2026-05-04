<script setup lang="ts">
import { Icon } from '@iconify/vue'

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

defineProps<{
  selectedPhotos: Photo[]
  selectedIds: Set<string>
}>()

const emit = defineEmits<{
  close: []
  delete: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-background/95 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] backdrop-blur-sm">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-3 sm:px-4 sm:py-3.5">
      <span class="whitespace-nowrap text-sm font-medium">
        {{ t('photoLibrary.selected', { n: selectedIds.size }) }}
      </span>

      <div class="flex items-center gap-2">
        <button
          class="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-background px-2.5 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10 sm:px-3.5"
          @click="emit('delete')"
        >
          <Icon icon="material-symbols:delete-outline" class="h-4 w-4 sm:h-5 sm:w-5" />
          <span class="hidden sm:inline">{{ t('photoLibrary.delete') }}</span>
        </button>
      </div>

      <button
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        @click="emit('close')"
      >
        <Icon icon="material-symbols:close" class="text-lg" />
      </button>
    </div>
  </div>
</template>
