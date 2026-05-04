import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import SettingsPage from '~/app/pages/platform/settings/index.vue'

const form = ref({
  siteName: 'My Site',
  homePageTitle: 'Home',
  siteDescription: '',
  siteUrl: '',
  socialLinks: {
    website: '',
    github: '',
    facebook: '',
    instagram: '',
    threads: '',
    x: '',
    email: '',
  },
  authorName: '',
  storageQuota: 0,
  showGpsInfo: false,
  showRssLink: false,
  exhibition: {
    coverPhotoId: null,
    title: '',
    subtitle: '',
    description: '',
    startDate: null,
    endDate: null,
    theme: 'white',
    coverTextColor: 'white',
    coverProtection: 'auto',
    sections: [],
  },
})

const save = vi.fn()

function mountSettings() {
  return mount({
    components: { SettingsPage },
    template: '<Suspense><SettingsPage /></Suspense>',
  }, {
    global: {
      stubs: {
        Icon: { template: '<span />' },
        Card: { template: '<section><slot /></section>' },
        CardHeader: { template: '<header><slot /></header>' },
        CardTitle: { template: '<h2><slot /></h2>' },
        CardContent: { template: '<div><slot /></div>' },
        Button: { template: '<button v-bind="$attrs"><slot /></button>' },
        Label: { template: '<label><slot /></label>' },
        Input: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
        Textarea: { props: ['modelValue'], emits: ['update:modelValue'], template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
      },
    },
  })
}

describe('platform settings page', () => {
  beforeEach(() => {
    save.mockReset()
    vi.stubGlobal('useSiteSettings', () => ({
      form,
      saving: ref(false),
      saved: ref(false),
      loaded: ref(true),
      load: vi.fn(),
      save,
    }))
  })

  it('keeps site identity and social link settings on the base settings page', async () => {
    const wrapper = mountSettings()
    await flushPromises()

    expect(wrapper.text()).toContain('settings.siteSettings')
    expect(wrapper.text()).toContain('settings.siteName')
    expect(wrapper.text()).toContain('settings.socialLinks')

    await wrapper.find('[data-test="settings-save"]').trigger('click')

    expect(save).toHaveBeenCalledTimes(1)
  })

  it('does not render removed layout or portfolio controls on the base settings page', async () => {
    const wrapper = mountSettings()
    await flushPromises()

    expect(wrapper.find('[data-test="public-layout-portfolio"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="portfolio-hero-open"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('settings.publicLayout')
    expect(wrapper.text()).not.toContain('settings.portfolioSelection')
  })
})
