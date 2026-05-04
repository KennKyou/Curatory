<script setup lang="ts">
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const config = useRuntimeConfig()
const siteKey = computed(() => String(config.public.turnstileSiteKey || ''))
const enabled = computed(() => Boolean(siteKey.value))
const container = ref<HTMLElement | null>(null)
let widgetId: string | null = null

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, any>) => string
      reset: (widgetId?: string) => void
      remove: (widgetId: string) => void
    }
  }
}

function loadScript() {
  if (!enabled.value || typeof window === 'undefined') return Promise.resolve()
  if (window.turnstile) return Promise.resolve()

  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Turnstile failed to load')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.dataset.turnstile = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Turnstile failed to load'))
    document.head.appendChild(script)
  })
}

async function renderWidget() {
  if (!enabled.value || !container.value || widgetId || typeof window === 'undefined') return
  await loadScript()
  if (!window.turnstile || !container.value) return

  widgetId = window.turnstile.render(container.value, {
    sitekey: siteKey.value,
    theme: 'auto',
    callback: (token: string) => emit('update:modelValue', token),
    'expired-callback': () => emit('update:modelValue', ''),
    'error-callback': () => emit('update:modelValue', ''),
  })
}

function reset() {
  emit('update:modelValue', '')
  if (widgetId && window.turnstile) {
    window.turnstile.reset(widgetId)
  }
}

onMounted(renderWidget)

onBeforeUnmount(() => {
  if (widgetId && window.turnstile) {
    window.turnstile.remove(widgetId)
  }
  widgetId = null
})

watch(siteKey, () => {
  if (!enabled.value || widgetId) return
  renderWidget()
})

defineExpose({ reset })
</script>

<template>
  <div v-if="enabled" class="flex justify-center">
    <div ref="container" />
  </div>
</template>
