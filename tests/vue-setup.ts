import { vi } from 'vitest'
import { ref, computed, onMounted, onUnmounted, watch, watchEffect, nextTick } from 'vue'

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', props: ['icon'], template: '<span />' },
}))

// Re-export Vue reactivity as globals (Nuxt auto-imports these)
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('onMounted', onMounted)
vi.stubGlobal('onUnmounted', onUnmounted)
vi.stubGlobal('watch', watch)
vi.stubGlobal('watchEffect', watchEffect)
vi.stubGlobal('nextTick', nextTick)

// Nuxt composable mocks
vi.stubGlobal('useI18n', () => ({
  t: (key: string) => key,
  locale: ref('zh-TW'),
}))

// useState shares state by key (like Nuxt does)
const stateStore = new Map<string, any>()
vi.stubGlobal('useState', <T>(key: string, init?: () => T) => {
  if (!stateStore.has(key)) {
    stateStore.set(key, ref(init ? init() : undefined))
  }
  return stateStore.get(key)
})

vi.stubGlobal('useFetch', vi.fn(() => ({
  data: ref(null),
  pending: ref(false),
  error: ref(null),
})))

vi.stubGlobal('$fetch', vi.fn(() => Promise.resolve({})))

vi.stubGlobal('useUserSession', () => ({
  loggedIn: ref(true),
}))

vi.stubGlobal('navigateTo', () => {})

vi.stubGlobal('definePageMeta', vi.fn())

vi.stubGlobal('useRuntimeConfig', () => ({}))

vi.stubGlobal('defineNuxtRouteMiddleware', (fn: Function) => fn)

// Clear useState cache between tests
import { afterEach } from 'vitest'
afterEach(() => {
  stateStore.clear()
})
