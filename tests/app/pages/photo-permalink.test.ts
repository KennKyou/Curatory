import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import PhotoPermalinkPage from '~/app/pages/photos/[slug].vue'

const photo = {
  id: '1',
  url: 'https://example.com/photo.jpg',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  key: 'photos/photo.jpg',
  slug: 'photo-1',
  size: 1024,
  width: 1600,
  height: 900,
  blurDataUrl: null,
  exif: null,
  takenAt: null,
  topReaction: null,
  reactionTotal: 0,
}

describe('photo permalink page', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('uses request-bound fetch for the photo API during SSR', async () => {
    const requestFetch = vi.fn(() => Promise.resolve(photo))
    const globalFetch = vi.fn(() => Promise.resolve(photo))

    vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }))
    vi.stubGlobal('useRoute', () => ({ params: { slug: 'photo-1' } }))
    vi.stubGlobal('useRequestFetch', () => requestFetch)
    vi.stubGlobal('$fetch', globalFetch)
    vi.stubGlobal('useHead', vi.fn())
    vi.stubGlobal('navigateTo', vi.fn())
    vi.stubGlobal('useAsyncData', async (_key: string, loader: () => Promise<unknown>) => {
      const data = await loader()
      return { data: ref(data), error: ref(null) }
    })

    mount({
      components: { PhotoPermalinkPage },
      template: '<Suspense><PhotoPermalinkPage /></Suspense>',
    }, {
      global: {
        stubs: {
          PhotoLightbox: { template: '<div />' },
        },
      },
    })
    await flushPromises()

    expect(requestFetch).toHaveBeenCalledWith('/api/photos/photo-1')
    expect(globalFetch).not.toHaveBeenCalled()
  })
})
