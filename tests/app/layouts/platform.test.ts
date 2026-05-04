import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import PlatformLayout from '~/app/layouts/platform.vue'

function mountPlatformLayout(path: string) {
  vi.stubGlobal('useRoute', () => ({ path }))
  vi.stubGlobal('useI18n', () => ({
    t: (key: string) => key,
    locale: ref('en'),
    locales: ref([{ code: 'en', name: 'English' }]),
    setLocale: vi.fn(),
  }))
  vi.stubGlobal('useUserSession', () => ({
    loggedIn: ref(false),
    user: ref(null),
    clear: vi.fn(),
  }))
  vi.stubGlobal('useFetch', vi.fn(() => ({
    data: ref({ siteName: 'Curatory' }),
  })))
  vi.stubGlobal('useHead', vi.fn())
  vi.stubGlobal('navigateTo', vi.fn())
  vi.stubGlobal('$fetch', vi.fn())

  return mount({
    components: { PlatformLayout },
    template: '<Suspense><PlatformLayout><main /></PlatformLayout></Suspense>',
  }, {
    global: {
      stubs: {
        Icon: { template: '<span />' },
        Toaster: { template: '<div />' },
        NuxtLink: {
          props: ['to'],
          template: '<a :href="typeof to === \'string\' ? to : \'#\'" v-bind="$attrs"><slot /></a>',
        },
        DropdownMenu: { template: '<div><slot /></div>' },
        DropdownMenuTrigger: { template: '<button><slot /></button>' },
        DropdownMenuContent: { template: '<div><slot /></div>' },
        DropdownMenuItem: { template: '<button><slot /></button>' },
      },
    },
  })
}

describe('platform layout navigation', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
  })

  it('links to the top-level exhibition page from desktop navigation', async () => {
    const wrapper = mountPlatformLayout('/platform')
    await flushPromises()

    const exhibitionLink = wrapper.find('a[href="/platform/exhibition"]')
    expect(exhibitionLink.exists()).toBe(true)
    expect(exhibitionLink.text()).toContain('platform.exhibition')
  })

  it('marks exhibition routes as active', async () => {
    const wrapper = mountPlatformLayout('/platform/exhibition/sections/section-a')
    await flushPromises()

    const exhibitionLink = wrapper.find('a[href="/platform/exhibition"]')
    expect(exhibitionLink.attributes('aria-current')).toBe('page')
  })
})
