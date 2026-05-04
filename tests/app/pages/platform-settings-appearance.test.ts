import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import ExhibitionPage from '~/app/pages/platform/exhibition/index.vue'
import SectionDetailPage from '~/app/pages/platform/exhibition/sections/[sectionId].vue'
import AppearanceRedirectPage from '~/app/pages/platform/settings/appearance/index.vue'

const platformPhotos = [
  { id: '1', key: 'cover.jpg', url: 'https://example.com/cover.jpg', thumbnailUrl: 'https://example.com/cover-thumb.jpg', slug: 'cover', size: 100, width: 1200, height: 800, blurDataUrl: null },
  { id: '2', key: 'room.jpg', url: 'https://example.com/room.jpg', thumbnailUrl: null, slug: 'room', size: 100, width: 1200, height: 800, blurDataUrl: null },
]

function createForm() {
  return ref({
    siteName: '',
    homePageTitle: '',
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
      coverPhotoId: null as string | null,
      title: '',
      subtitle: '',
      description: '',
      startDate: null as string | null,
      endDate: null as string | null,
      theme: 'white' as const,
      coverTextColor: 'white' as const,
      coverProtection: 'auto' as const,
      sections: [] as Array<{
        id: string
        layout: 'media' | 'text'
        theme: 'white' | 'black'
        title: string
        body: string
        photoIds: string[]
        textPosition: 'none' | 'left' | 'right' | 'bottom'
        desktopTextAlign: 'left' | 'center' | 'right'
        mobileTextAlign: 'left' | 'center' | 'right'
        reserveTextSpace: boolean
      }>,
    },
  })
}

const save = vi.fn()
const navigateTo = vi.fn()
const definePageMeta = vi.fn()
let form = createForm()

const commonStubs = {
  Icon: { template: '<span />' },
  Card: { template: '<section><slot /></section>' },
  CardHeader: { template: '<header><slot /></header>' },
  CardTitle: { template: '<h2><slot /></h2>' },
  CardContent: { template: '<div><slot /></div>' },
  Button: { template: '<button v-bind="$attrs" @click="$emit(\'click\', $event)"><slot /></button>' },
  Dialog: { template: '<div><slot /></div>' },
  DialogContent: { template: '<div v-bind="$attrs"><slot /></div>' },
  DialogDescription: { template: '<p><slot /></p>' },
  DialogFooter: { template: '<footer><slot /></footer>' },
  DialogHeader: { template: '<header><slot /></header>' },
  DialogTitle: { template: '<h2><slot /></h2>' },
  Label: { template: '<label><slot /></label>' },
  Input: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
  Textarea: { props: ['modelValue'], emits: ['update:modelValue'], template: '<textarea v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
  Switch: { props: ['modelValue'], emits: ['update:modelValue'], template: '<button v-bind="$attrs" type="button" @click="$emit(\'update:modelValue\', !modelValue)" />' },
  NuxtLink: { props: ['to'], template: '<a v-bind="$attrs" :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>' },
  RouterLink: { props: ['to'], template: '<a v-bind="$attrs" :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>' },
}

function mountAppearance() {
  return mount({
    components: { ExhibitionPage },
    template: '<Suspense><ExhibitionPage /></Suspense>',
  }, {
    global: {
      stubs: commonStubs,
    },
  })
}

function mountAppearanceRedirect() {
  return mount({
    components: { AppearanceRedirectPage },
    template: '<Suspense><AppearanceRedirectPage /></Suspense>',
  }, {
    global: {
      stubs: commonStubs,
    },
  })
}

function mountSectionDetail(sectionId: string) {
  vi.stubGlobal('useRoute', () => ({ params: { sectionId } }))

  return mount({
    components: { SectionDetailPage },
    template: '<Suspense><SectionDetailPage /></Suspense>',
  }, {
    global: {
      stubs: commonStubs,
    },
  })
}

describe('platform appearance settings page', () => {
  beforeEach(() => {
    form = createForm()
    save.mockReset()
    navigateTo.mockReset()
    definePageMeta.mockReset()
    vi.stubGlobal('navigateTo', navigateTo)
    vi.stubGlobal('definePageMeta', definePageMeta)
    vi.stubGlobal('useSiteSettings', () => ({
      form,
      saving: ref(false),
      saved: ref(false),
      loaded: ref(true),
      load: vi.fn(),
      save,
    }))
    vi.stubGlobal('useFetch', vi.fn(() => ({
      data: ref({ photos: platformPhotos, hasMore: false, lastId: null }),
      pending: ref(false),
      error: ref(null),
    })))
    vi.stubGlobal('$fetch', vi.fn(() => Promise.resolve({ photos: [], hasMore: false, lastId: null })))
  })

  it('renders exhibition settings and saves through the shared settings composable', async () => {
    const wrapper = mountAppearance()
    await flushPromises()

    expect(definePageMeta).toHaveBeenCalledWith({ layout: 'platform' })
    expect(wrapper.find('h1').text()).toBe('settings.exhibitionPageTitle')
    expect(wrapper.find('h1').classes()).toContain('text-2xl')
    expect(wrapper.find('[data-test="exhibition-settings"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-title-input"]').exists()).toBe(true)

    await wrapper.find('[data-test="settings-save"]').trigger('click')

    expect(save).toHaveBeenCalled()
  })

  it('redirects the legacy appearance route to the top-level exhibition page', async () => {
    mountAppearanceRedirect()
    await flushPromises()

    expect(navigateTo).toHaveBeenCalledWith('/platform/exhibition', { replace: true })
  })

  it('selects and clears the exhibition cover photo with preview state', async () => {
    const wrapper = mountAppearance()
    await flushPromises()

    await wrapper.find('[data-test="exhibition-cover-open"]').trigger('click')
    await nextTick()
    await wrapper.find('[data-test="exhibition-photo-option-1"]').trigger('click')
    await nextTick()

    expect(form.value.exhibition.coverPhotoId).toBe('1')
    expect(wrapper.find('[data-test="exhibition-selected-cover-preview"]').attributes('src')).toBe('https://example.com/cover-thumb.jpg')

    await wrapper.find('[data-test="exhibition-cover-clear"]').trigger('click')

    expect(form.value.exhibition.coverPhotoId).toBe(null)
  })

  it('adds a fixed-layout exhibition section from the section type dialog', async () => {
    const wrapper = mountAppearance()
    await flushPromises()

    await wrapper.find('[data-test="exhibition-section-add"]').trigger('click')
    await nextTick()

    expect(wrapper.find('[data-test="exhibition-section-type-picker"]').exists()).toBe(true)

    await wrapper.find('[data-test="exhibition-section-type-media"]').trigger('click')
    await nextTick()

    expect(form.value.exhibition.sections).toHaveLength(1)
    expect(form.value.exhibition.sections[0]).toMatchObject({
      layout: 'media',
      desktopTextAlign: 'left',
      mobileTextAlign: 'left',
      photoIds: [],
      title: '',
      body: '',
    })
    expect(wrapper.find('[data-test="exhibition-section-edit-0"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-title-0"]').exists()).toBe(false)
  })

  it('renders exhibition sections as a structure list without inline detail controls', async () => {
    form.value.exhibition.sections = [
      {
        id: 'section-media',
        layout: 'media',
        theme: 'white',
        title: 'Gallery intro',
        body: 'A short section body',
        photoIds: ['1', '2'],
        textPosition: 'right',
        desktopTextAlign: 'right',
        mobileTextAlign: 'left',
        reserveTextSpace: true,
      },
      {
        id: 'section-text',
        layout: 'text',
        theme: 'white',
        title: 'Written note',
        body: '',
        photoIds: [],
        textPosition: 'none',
        desktopTextAlign: 'center',
        mobileTextAlign: 'center',
        reserveTextSpace: false,
      },
    ]

    const wrapper = mountAppearance()
    await flushPromises()

    expect(wrapper.find('[data-test="exhibition-section-row-section-media"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-row-section-text"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-edit-0"]').attributes('href')).toBe('/platform/exhibition/sections/section-media')
    expect(wrapper.find('[data-test="exhibition-section-summary-0"]').text()).toContain('Gallery intro')
    expect(wrapper.find('[data-test="exhibition-section-summary-0"]').text()).toContain('2')
    expect(wrapper.find('[data-test="exhibition-section-up-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-down-0"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-remove-0"]').exists()).toBe(true)

    expect(wrapper.find('[data-test="exhibition-section-title-0"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="exhibition-section-body-0"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="exhibition-section-photo-open-0"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="exhibition-section-text-position-right-0"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="exhibition-section-reserve-text-space"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="exhibition-section-desktop-text-align-left"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="exhibition-section-mobile-text-align-left"]').exists()).toBe(false)
  })

  it('edits a media exhibition section on its detail route', async () => {
    form.value.exhibition.sections = [
      {
        id: 'section-media',
        layout: 'media',
        theme: 'white',
        title: 'Gallery intro',
        body: 'A short section body',
        photoIds: ['1'],
        textPosition: 'right',
        desktopTextAlign: 'right',
        mobileTextAlign: 'left',
        reserveTextSpace: true,
      },
    ]

    const wrapper = mountSectionDetail('section-media')
    await flushPromises()

    expect(wrapper.find('[data-test="exhibition-section-detail"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-title"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-body"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-text-position-none"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-text-position-left"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-text-position-right"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-text-position-bottom"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-desktop-text-align-left"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-desktop-text-align-center"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-desktop-text-align-right"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-mobile-text-align-left"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-mobile-text-align-center"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-mobile-text-align-right"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-reserve-text-space"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-photo-open-0"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-photo-open-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-cancel"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-layout-switch"]').exists()).toBe(false)

    await wrapper.find('[data-test="exhibition-section-title"]').setValue('Updated title')
    await wrapper.find('[data-test="exhibition-section-text-position-bottom"]').trigger('click')
    await wrapper.find('[data-test="exhibition-section-desktop-text-align-center"]').trigger('click')
    await wrapper.find('[data-test="exhibition-section-mobile-text-align-right"]').trigger('click')
    await wrapper.find('[data-test="settings-save"]').trigger('click')

    expect(form.value.exhibition.sections[0]).toMatchObject({
      id: 'section-media',
      layout: 'media',
      title: 'Updated title',
      textPosition: 'bottom',
      desktopTextAlign: 'center',
      mobileTextAlign: 'right',
      photoIds: ['1'],
    })
    expect(save).toHaveBeenCalled()
  })

  it('cancels section detail edits by restoring the section and returning to the list', async () => {
    form.value.exhibition.sections = [
      {
        id: 'section-media',
        layout: 'media',
        theme: 'white',
        title: 'Original title',
        body: 'Original body',
        photoIds: ['1'],
        textPosition: 'right',
        desktopTextAlign: 'right',
        mobileTextAlign: 'left',
        reserveTextSpace: true,
      },
    ]

    const wrapper = mountSectionDetail('section-media')
    await flushPromises()

    await wrapper.find('[data-test="exhibition-section-title"]').setValue('Unsaved title')
    await wrapper.find('[data-test="exhibition-section-text-position-bottom"]').trigger('click')
    await wrapper.find('[data-test="exhibition-section-cancel"]').trigger('click')

    expect(form.value.exhibition.sections[0]).toMatchObject({
      title: 'Original title',
      body: 'Original body',
      textPosition: 'right',
      desktopTextAlign: 'right',
      mobileTextAlign: 'left',
      photoIds: ['1'],
    })
    expect(save).not.toHaveBeenCalled()
    expect(navigateTo).toHaveBeenCalledWith('/platform/exhibition')
  })

  it('edits a text exhibition section without media-only controls', async () => {
    form.value.exhibition.sections = [
      {
        id: 'section-text',
        layout: 'text',
        theme: 'white',
        title: 'Written note',
        body: 'Only words',
        photoIds: [],
        textPosition: 'none',
        desktopTextAlign: 'center',
        mobileTextAlign: 'center',
        reserveTextSpace: false,
      },
    ]

    const wrapper = mountSectionDetail('section-text')
    await flushPromises()

    expect(wrapper.find('[data-test="exhibition-section-title"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-body"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-desktop-text-align-center"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-mobile-text-align-center"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-section-photo-open-0"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="exhibition-section-text-position-none"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="exhibition-section-reserve-text-space"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="exhibition-section-layout-switch"]').exists()).toBe(false)
  })

  it('shows a missing state for unknown section ids without creating a section', async () => {
    form.value.exhibition.sections = []

    const wrapper = mountSectionDetail('missing-section')
    await flushPromises()

    expect(wrapper.find('[data-test="exhibition-section-missing"]').exists()).toBe(true)
    expect(form.value.exhibition.sections).toHaveLength(0)
  })
})
