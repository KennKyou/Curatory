import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsShell from '~/app/pages/platform/settings.vue'

function mountSettingsShell(path: string) {
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }))

  return mount(SettingsShell, {
    global: {
      stubs: {
        NuxtLink: {
          props: ['to'],
          template: '<a :data-to="to" v-bind="$attrs"><slot /></a>',
        },
        NuxtPage: { template: '<main />' },
      },
    },
  })
}

describe('platform settings shell', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the settings title without sub-tabs', () => {
    const wrapper = mountSettingsShell('/platform/settings')

    expect(wrapper.find('h1').text()).toBe('settings.title')
    expect(wrapper.find('[data-to="/platform/settings"]').exists()).toBe(false)
    expect(wrapper.find('[data-to="/platform/settings/appearance"]').exists()).toBe(false)
  })
})
