import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { useSiteSettings } from '~/app/composables/useSiteSettings'

function withSetup<T>(composable: () => T): T {
  let result!: T
  mount(defineComponent({
    setup() {
      result = composable()
      return {}
    },
    template: '<div />',
  }))
  return result
}

describe('useSiteSettings', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', vi.fn(() => Promise.resolve({})))
    vi.stubGlobal('useFetch', vi.fn(() => ({
      data: ref(null),
      pending: ref(false),
      error: ref(null),
    })))
  })

  it('initializes form with Curatory defaults', () => {
    const { form } = withSetup(() => useSiteSettings())

    expect(form.value.siteName).toBe('')
    expect(form.value.homePageTitle).toBe('')
    expect(form.value.storageQuota).toBe(0)
    expect(form.value.showGpsInfo).toBe(false)
    expect(form.value.socialLinks.github).toBe('')
    expect(form.value.exhibition).toEqual({
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
    })
  })

  it('load() populates site and exhibition settings', async () => {
    vi.stubGlobal('useFetch', vi.fn(() => ({
      data: ref({
        siteName: 'Test Site',
        homePageTitle: 'Welcome',
        siteDescription: 'Desc',
        siteUrl: 'https://example.com',
        socialLinks: { website: '', github: 'https://github.com/test', facebook: '', instagram: '', threads: '', x: '', email: '' },
        authorName: 'Author',
        storageQuota: 5 * 1024 ** 3,
        showGpsInfo: false,
        showRssLink: false,
        exhibition: {
          coverPhotoId: 'cover-id',
          title: 'Island Light',
          subtitle: '',
          description: '',
          startDate: null,
          endDate: null,
          theme: 'black',
          coverTextColor: 'white',
          coverProtection: 'auto',
          sections: [],
        },
      }),
      pending: ref(false),
      error: ref(null),
    })))

    const { form, loaded, load } = withSetup(() => useSiteSettings())
    await load()

    expect(form.value.siteName).toBe('Test Site')
    expect(form.value.storageQuota).toBe(0)
    expect(form.value.showGpsInfo).toBe(false)
    expect(form.value.exhibition.title).toBe('Island Light')
    expect(form.value.exhibition.theme).toBe('black')
    expect(loaded.value).toBe(true)
  })

  it('save() sends only editable site and exhibition settings', async () => {
    const mockFetch = vi.fn().mockResolvedValue({})
    vi.stubGlobal('$fetch', mockFetch)

    const { form, save } = withSetup(() => useSiteSettings())
    form.value.siteName = 'My Site'
    form.value.exhibition.title = 'My Exhibition'

    await save()

    expect(mockFetch).toHaveBeenCalledWith('/api/platform/settings', expect.objectContaining({
      method: 'PUT',
      body: expect.objectContaining({
        siteName: 'My Site',
        exhibition: expect.objectContaining({ title: 'My Exhibition' }),
      }),
    }))
    expect(mockFetch.mock.calls[0][1].body).not.toHaveProperty('storageQuota')
    expect(mockFetch.mock.calls[0][1].body).not.toHaveProperty('publicLayout')
  })

  it('save() sets saved to true on success', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({}))

    const { save, saved } = withSetup(() => useSiteSettings())
    await save()

    expect(saved.value).toBe(true)
  })
})
