<script setup lang="ts">
import { toast } from 'vue-sonner'

const { t } = useI18n()
const scanning = ref(false)
const elapsed = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

const phase = ref('')
const currentKey = ref('')
const progressCurrent = ref(0)
const progressTotal = ref(0)
const thumbnailsGenerated = ref(0)
const thumbnailsFailed = ref(0)

const result = ref<{
  total: number
  added: number
  removed: number
  unchanged: number
  thumbnailsGenerated: number
  thumbnailsFailed: number
} | null>(null)
const error = ref('')

const emit = defineEmits<{
  scanned: []
}>()

const elapsedText = computed(() => {
  const s = elapsed.value
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
})

const progressPercent = computed(() => {
  if (progressTotal.value === 0) return 0
  return Math.round((progressCurrent.value / progressTotal.value) * 100)
})

function startTimer() {
  elapsed.value = 0
  timer = setInterval(() => {
    elapsed.value++
  }, 1000)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function resetProgress() {
  phase.value = ''
  currentKey.value = ''
  progressCurrent.value = 0
  progressTotal.value = 0
  thumbnailsGenerated.value = 0
  thumbnailsFailed.value = 0
}

async function scan() {
  scanning.value = true
  result.value = null
  error.value = ''
  resetProgress()
  startTimer()

  try {
    const response = await fetch('/api/s3/scan', { method: 'POST' })

    if (!response.ok) {
      const errData = await response.json().catch(() => null)
      throw new Error(errData?.message || `HTTP ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const data = JSON.parse(line.slice(6))
          handleEvent(data)
        } catch {
          // skip malformed lines
        }
      }
    }
  } catch (err: any) {
    error.value = err.message || t('scan.scanFailed')
    toast.error(error.value)
  } finally {
    scanning.value = false
    stopTimer()
  }
}

function handleEvent(data: any) {
  switch (data.phase) {
    case 'listing':
      phase.value = 'listing'
      break
    case 'thumbnail':
      phase.value = 'thumbnail'
      progressCurrent.value = data.current
      progressTotal.value = data.total
      currentKey.value = data.key
      thumbnailsGenerated.value++
      break
    case 'thumbnail-error':
      phase.value = 'thumbnail'
      progressCurrent.value = data.current
      progressTotal.value = data.total
      currentKey.value = data.key
      thumbnailsFailed.value++
      break
    case 'cleanup':
      phase.value = 'cleanup'
      break
    case 'complete':
      result.value = {
        total: data.total,
        added: data.added,
        removed: data.removed,
        unchanged: data.unchanged,
        thumbnailsGenerated: data.thumbnailsGenerated,
        thumbnailsFailed: data.thumbnailsFailed,
      }
      toast.success(t('scan.scanComplete', { added: data.added, removed: data.removed }))
      emit('scanned')
      break
    case 'error':
      error.value = data.message || t('scan.scanFailed')
      toast.error(error.value)
      break
  }
}

onUnmounted(() => stopTimer())
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-3">
      <Button :disabled="scanning" @click="scan">
        {{ scanning ? t('scan.scanning') : t('scan.scanBucket') }}
      </Button>
    </div>

    <Card v-if="scanning" class="border-primary/30 p-4 text-sm">
      <CardContent class="space-y-3 p-0">
        <div class="flex items-center gap-3">
          <div class="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <div class="flex-1 min-w-0">
            <div class="font-medium">
              <template v-if="phase === 'listing'">{{ t('scan.listing') }}</template>
              <template v-else-if="phase === 'thumbnail'">
                {{ t('scan.progressCount', { current: progressCurrent, total: progressTotal }) }}
              </template>
              <template v-else-if="phase === 'cleanup'">{{ t('scan.cleaningUp') }}</template>
              <template v-else>{{ t('scan.scanInProgress') }}</template>
            </div>
            <div v-if="phase === 'thumbnail' && currentKey" class="text-muted-foreground truncate">
              {{ currentKey.split('/').pop() }}
            </div>
            <div class="text-muted-foreground text-xs mt-1">{{ elapsedText }}</div>
          </div>
        </div>

        <div v-if="phase === 'thumbnail' && progressTotal > 0" class="space-y-1">
          <div class="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              class="h-full bg-primary rounded-full transition-all duration-300"
              :style="{ width: `${progressPercent}%` }"
            />
          </div>
          <div class="flex justify-between text-xs text-muted-foreground">
            <span>{{ progressPercent }}%</span>
            <span v-if="thumbnailsFailed > 0" class="text-destructive">
              {{ t('scan.thumbnailsFailed') }}: {{ thumbnailsFailed }}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>

    <div v-if="error" class="text-sm text-destructive">{{ error }}</div>

    <Card v-if="result" class="p-4 text-sm">
      <CardContent class="p-0">
        <div class="grid grid-cols-2 gap-2">
          <div>{{ t('scan.totalImages') }}: <strong>{{ result.total }}</strong></div>
          <div>{{ t('scan.added') }}: <strong>{{ result.added }}</strong></div>
          <div>{{ t('scan.removed') }}: <strong>{{ result.removed }}</strong></div>
          <div>{{ t('scan.unchanged') }}: <strong>{{ result.unchanged }}</strong></div>
          <div>{{ t('scan.thumbnailsGenerated') }}: <strong>{{ result.thumbnailsGenerated }}</strong></div>
          <div v-if="result.thumbnailsFailed > 0" class="text-destructive">
            {{ t('scan.thumbnailsFailed') }}: <strong>{{ result.thumbnailsFailed }}</strong>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
