import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import PhotoLightbox from '~/app/components/PhotoLightbox.vue'

vi.mock('@/stores/reactions', () => ({
  useReactionsStore: () => ({
    hasReacted: () => false,
    isBusy: () => false,
    toggleReaction: vi.fn(),
  }),
}))

function createT(_locale: 'en' | 'zh-TW') {
  return (key: string, params?: Record<string, unknown>) => {
    const message = key
    if (!params) return message
    return Object.entries(params).reduce(
      (text, [name, value]) => text.replace(`{${name}}`, String(value)),
      message,
    )
  }
}

function makePhoto(overrides: Record<string, any> = {}) {
  return {
    id: 'photo-1',
    url: 'https://example.com/original.jpg',
    thumbnailUrl: null,
    key: 'photos/original.jpg',
    slug: 'original',
    width: 1600,
    height: 900,
    size: 1024,
    exif: {
      Image: {
        Make: 'Sony',
        Model: 'ZV-E10',
      },
      Photo: {
        PixelXDimension: 1600,
        PixelYDimension: 900,
        ColorSpace: 65535,
        ExposureProgram: 3,
        ExposureMode: 2,
        MeteringMode: 3,
        WhiteBalance: 1,
        Flash: 17,
        LightSource: 123,
        SceneCaptureType: 3,
      },
    },
    takenAt: null,
    toneAnalysis: {
      toneType: 'Low Key',
      brightness: 50,
      contrast: 40,
      shadowRatio: 10,
      highlightRatio: 10,
      histogram: new Array(256).fill(1),
    },
    reactionCounts: {
      heartEyes: 0,
      starStruck: 0,
      thumbsUp: 0,
      fire: 0,
      raisedHands: 0,
      camera: 0,
    },
    topReaction: null,
    reactionTotal: 0,
    ...overrides,
  }
}

async function mountLightbox(locale: 'en' | 'zh-TW') {
  vi.stubGlobal('useI18n', () => ({
    t: createT(locale),
    locale: ref(locale),
  }))

  const wrapper = mount(PhotoLightbox, {
    attachTo: document.body,
    props: {
      photos: [makePhoto()],
      initialIndex: 0,
      rect: new DOMRect(0, 0, 160, 90),
      mode: 'fade',
    },
    global: {
      stubs: {
        Teleport: true,
        Icon: { template: '<span />' },
        FluentEmoji: { template: '<span />' },
        Transition: false,
      },
    },
  })

  await nextTick()
  await nextTick()
  return wrapper
}

describe('PhotoLightbox viewer chrome', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('does not render the metadata info panel in Curatory', async () => {
    const wrapper = await mountLightbox('zh-TW')
    const text = wrapper.text()

    expect(text).not.toContain('直方圖')
    expect(text).not.toContain('光圈優先')
    expect(text).not.toContain('自動包圍曝光')
    expect(text).not.toContain('點測光')
    expect(text).not.toContain('手動')
    expect(text).not.toContain('已閃光（自動）')
    expect(text).not.toContain('未知 (123)')
    expect(text).not.toContain('夜景')
    expect(text).not.toContain('未校準')
    expect(text).not.toContain('低調')
    expect(text).not.toContain('Aperture priority')
    expect(text).not.toContain('Auto bracket')
    expect(text).not.toContain('Night scene')
    expect(text).not.toContain('Low Key')
  })

  it('keeps share controls available without the metadata panel', async () => {
    const wrapper = await mountLightbox('en')
    const text = wrapper.text()

    expect(text).not.toContain('Histogram')
    expect(text).not.toContain('Aperture priority')
    expect(wrapper.findAll('button').length).toBeGreaterThan(0)
  })
})

describe('PhotoLightbox original image cache', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.useFakeTimers()
    vi.stubGlobal('useI18n', () => ({
      t: createT('en'),
      locale: ref('en'),
    }))
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      headers: { get: (name: string) => name.toLowerCase() === 'content-length' ? '3' : null },
      body: {
        getReader: () => {
          let read = false
          return {
            read: vi.fn(async () => {
              if (read) return { done: true, value: undefined }
              read = true
              return { done: false, value: new Uint8Array([1, 2, 3]) }
            }),
          }
        },
      },
      url,
    })))
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob) => `blob:${blob.size}:${Math.random()}`)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  async function mountCachedLightbox(photos: ReturnType<typeof makePhoto>[]) {
    const wrapper = mount(PhotoLightbox, {
      attachTo: document.body,
      props: {
        photos,
        initialIndex: 0,
        rect: new DOMRect(0, 0, 160, 90),
        mode: 'fade',
      },
      global: {
        stubs: {
          Teleport: true,
          Icon: { template: '<span />' },
          FluentEmoji: { template: '<span />' },
          Transition: false,
        },
      },
    })

    await flushPromises()
    await nextTick()
    await flushPromises()
    return wrapper
  }

  async function navigateWithKeyboard(key: 'ArrowLeft' | 'ArrowRight') {
    document.dispatchEvent(new KeyboardEvent('keydown', { key }))
    await vi.advanceTimersByTimeAsync(600)
    await flushPromises()
    await nextTick()
    await flushPromises()
  }

  it('does not fetch the same original image again when revisiting a cached photo', async () => {
    await mountCachedLightbox([
      makePhoto({ id: 'photo-1', url: 'https://example.com/original-1.jpg', thumbnailUrl: 'https://example.com/thumb-1.jpg', slug: 'photo-1' }),
      makePhoto({ id: 'photo-2', url: 'https://example.com/original-2.jpg', thumbnailUrl: 'https://example.com/thumb-2.jpg', slug: 'photo-2' }),
    ])

    await navigateWithKeyboard('ArrowRight')
    await navigateWithKeyboard('ArrowLeft')

    const fetchedUrls = vi.mocked(fetch).mock.calls.map(([url]) => String(url))
    expect(fetchedUrls.filter(url => url === 'https://example.com/original-1.jpg')).toHaveLength(1)
    expect(fetchedUrls.filter(url => url === 'https://example.com/original-2.jpg')).toHaveLength(1)
  })

  it('evicts the least recently used original image after five cached photos', async () => {
    const photos = Array.from({ length: 6 }, (_, index) =>
      makePhoto({
        id: `photo-${index + 1}`,
        url: `https://example.com/original-${index + 1}.jpg`,
        thumbnailUrl: `https://example.com/thumb-${index + 1}.jpg`,
        slug: `photo-${index + 1}`,
      }),
    )
    await mountCachedLightbox(photos)

    for (let i = 1; i < photos.length; i++) {
      await navigateWithKeyboard('ArrowRight')
    }

    expect(URL.createObjectURL).toHaveBeenCalledTimes(6)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  })

  it('revokes every cached original image object URL when unmounted', async () => {
    const wrapper = await mountCachedLightbox([
      makePhoto({ id: 'photo-1', url: 'https://example.com/original-1.jpg', thumbnailUrl: 'https://example.com/thumb-1.jpg', slug: 'photo-1' }),
      makePhoto({ id: 'photo-2', url: 'https://example.com/original-2.jpg', thumbnailUrl: 'https://example.com/thumb-2.jpg', slug: 'photo-2' }),
    ])
    await navigateWithKeyboard('ArrowRight')

    vi.mocked(URL.revokeObjectURL).mockClear()
    wrapper.unmount()

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
  })
})
