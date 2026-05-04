import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ExhibitionLayout from '~/app/components/ExhibitionLayout.vue'

const photo = {
  id: '1',
  url: 'https://example.com/photo.jpg',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  key: 'photos/photo.jpg',
  slug: 'photo-1',
  size: 1024,
  width: 1600,
  height: 900,
  blurDataUrl: 'data:image/jpeg;base64,abc',
  exif: null,
  takenAt: null,
  topReaction: null,
  reactionTotal: 0,
}

const photoB = {
  ...photo,
  id: '2',
  url: 'https://example.com/photo-b.jpg',
  thumbnailUrl: 'https://example.com/thumb-b.jpg',
  key: 'photos/photo-b.jpg',
  slug: 'photo-2',
}

const photoC = {
  ...photo,
  id: '3',
  url: 'https://example.com/photo-c.jpg',
  thumbnailUrl: 'https://example.com/thumb-c.jpg',
  key: 'photos/photo-c.jpg',
  slug: 'photo-3',
}

const exhibition = {
  coverPhotoId: '1',
  title: 'Island Light',
  subtitle: 'Spring rooms',
  description: 'A short exhibition note.',
  startDate: '2026-05-01',
  endDate: '2026-05-31',
  theme: 'black',
  coverTextColor: 'black',
  coverProtection: 'auto',
  sections: [
    {
      id: 'section-a',
      layout: 'media',
      theme: 'white',
      title: 'Opening',
      body: 'Opening body',
      photoIds: ['1'],
      textPosition: 'right',
      desktopTextAlign: 'left',
      mobileTextAlign: 'left',
      reserveTextSpace: false,
    },
    {
      id: 'section-b',
      layout: 'text',
      theme: 'black',
      title: 'Closing',
      body: 'Closing body',
      photoIds: [],
      textPosition: 'none',
      desktopTextAlign: 'center',
      mobileTextAlign: 'center',
      reserveTextSpace: false,
    },
  ],
}

function mountLayout(overrides = {}) {
  vi.stubGlobal('useI18n', () => ({
    t: (key: string) => key === 'exhibition.viewDetails' ? 'View details' : key,
  }))

  return mount(ExhibitionLayout, {
    props: {
      photos: [photo],
      exhibition,
      exhibitionCoverPhoto: photo,
      exhibitionSectionPhotos: [{ id: 'section-a', photos: [photo] }, { id: 'section-b', photos: [] }],
      ...overrides,
    },
    global: {
      stubs: {
        Icon: { template: '<span />' },
      },
    },
  })
}

describe('ExhibitionLayout', () => {
  function mockDesktopMedia() {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query.includes('min-width'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })))
  }

  it('renders cover metadata, cover text color, and ordered sections', () => {
    const wrapper = mountLayout()

    expect(wrapper.find('[data-test="exhibition-layout"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-cover"]').text()).toContain('Island Light')
    expect(wrapper.find('[data-test="exhibition-cover"]').text()).toContain('Spring rooms')
    expect(wrapper.find('[data-test="exhibition-cover"]').text()).toContain('A short exhibition note.')
    expect(wrapper.find('[data-test="exhibition-cover"]').text()).toContain('May 1, 2026 - May 31, 2026')
    expect(wrapper.find('[data-test="exhibition-cover"]').classes()).toContain('bg-zinc-950')
    expect(wrapper.find('[data-test="exhibition-cover-copy"]').classes()).toContain('text-black')
    const sections = wrapper.findAll('[data-test^="exhibition-section-"]')
    expect(sections.map(section => section.find('h2').text())).toEqual(['Opening', 'Closing'])
    expect(sections.map(section => section.find('p').text())).toEqual(['Opening body', 'Closing body'])
  })

  it('renders exhibition content in horizontal swiper slides on desktop', async () => {
    mockDesktopMedia()
    const wrapper = mountLayout()
    await nextTick()

    expect(wrapper.find('[data-test="exhibition-swiper"]').exists()).toBe(true)
    const section = wrapper.find('[data-test="exhibition-swiper"] [data-test="exhibition-section-section-a"]')
    expect(section.classes()).toContain('min-h-screen')
    expect(wrapper.find('[data-test="exhibition-swiper"] .h-\\[80vh\\]').exists()).toBe(true)
  })

  it('renders a vertical mobile flow without swiper before desktop activation', () => {
    const wrapper = mountLayout()

    expect(wrapper.find('[data-test="exhibition-mobile-flow"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="exhibition-mobile-flow"] [data-test="exhibition-cover"]').classes()).toContain('min-h-screen')
  })

  it('emits selected photos for lightbox integration', async () => {
    const wrapper = mountLayout()

    await wrapper.find('[data-test="exhibition-cover-photo"]').trigger('click')

    expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({ photo, mode: 'fade' })
  })

  it('renders localized hover cues for clickable exhibition photos without blocking lightbox clicks', async () => {
    const wrapper = mountLayout()

    const coverButton = wrapper.find('[data-test="exhibition-cover-photo"]')
    const photoButton = wrapper.find('[data-test="exhibition-photo-button"]')

    expect(coverButton.classes()).toContain('cursor-zoom-in')
    expect(photoButton.classes()).toContain('cursor-zoom-in')
    const coverCue = coverButton.find('[data-test="exhibition-photo-hover-cue"]')
    const photoCue = photoButton.find('[data-test="exhibition-photo-hover-cue"]')
    expect(coverCue.text()).toBe('View details')
    expect(photoCue.text()).toBe('View details')
    expect(photoCue.classes()).toContain('pointer-events-none')
    expect(photoCue.classes()).toContain('[@media(hover:hover)_and_(pointer:fine)]:block')

    await photoButton.trigger('click')

    expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({ photo, mode: 'fade' })
  })

  it('renders media sections with left text and a right-side image', () => {
    const wrapper = mountLayout({
      exhibition: {
        ...exhibition,
        sections: [
          {
            id: 'section-c',
            layout: 'media',
            theme: 'white',
            title: 'Left Text',
            body: 'Right image body',
            photoIds: ['1'],
            textPosition: 'left',
            reserveTextSpace: false,
          },
        ],
      },
      exhibitionSectionPhotos: [{ id: 'section-c', photos: [photo] }],
    })

    const section = wrapper.find('[data-test="exhibition-section-section-c"]')
    expect(section.find('h2').text()).toBe('Left Text')
    expect(section.find('p').text()).toBe('Right image body')
    expect(section.find('img').exists()).toBe(true)
  })

  it('renders an empty state without crashing when no cover or sections exist', () => {
    const wrapper = mountLayout({
      photos: [],
      exhibition: { ...exhibition, coverPhotoId: null, title: '', sections: [] },
      exhibitionCoverPhoto: null,
      exhibitionSectionPhotos: [],
    })

    expect(wrapper.find('[data-test="exhibition-empty"]').exists()).toBe(true)
  })

  it('renders gallery sections in configured photo order', () => {
    const wrapper = mountLayout({
      exhibition: {
        ...exhibition,
        sections: [
          {
            id: 'gallery-section',
            layout: 'media',
            theme: 'white',
            title: 'Room Views',
            body: 'A small group.',
            photoIds: ['2', '1', '3'],
            textPosition: 'right',
            reserveTextSpace: false,
          },
        ],
      },
      exhibitionSectionPhotos: [{ id: 'gallery-section', photos: [photoB, photo, photoC] }],
    })

    const section = wrapper.find('[data-test="exhibition-section-gallery-section"]')
    const buttons = section.findAll('[data-test="exhibition-photo-button"]')
    const images = section.findAll('[data-test="exhibition-photo-button"] img')
    expect(section.find('[data-test="exhibition-gallery-images"]').exists()).toBe(true)
    expect(buttons.every(button => button.classes().includes('max-h-[34vh]'))).toBe(true)
    expect(buttons.some(button => button.classes().includes('w-full'))).toBe(false)
    expect(images.map(image => image.attributes('alt'))).toEqual(['photos/photo-b.jpg', 'photos/photo.jpg', 'photos/photo-c.jpg'])
  })

  it('centers gallery images on desktop when the gallery has no text content', async () => {
    mockDesktopMedia()
    const wrapper = mountLayout({
      exhibition: {
        ...exhibition,
        sections: [
          {
            id: 'gallery-section',
            layout: 'media',
            theme: 'white',
            title: '',
            body: '',
            photoIds: ['2', '1'],
            textPosition: 'none',
            reserveTextSpace: false,
          },
        ],
      },
      exhibitionSectionPhotos: [{ id: 'gallery-section', photos: [photoB, photo] }],
    })
    await nextTick()

    const section = wrapper.find('[data-test="exhibition-swiper"] [data-test="exhibition-section-gallery-section"]')
    expect(section.find('.lg\\:grid-cols-1').exists()).toBe(true)
    const gallery = section.find('[data-test="exhibition-gallery-images"]')
    expect(gallery.classes()).toContain('mx-auto')
    expect(gallery.classes()).toContain('place-items-center')
    expect(section.findAll('[data-test="exhibition-photo-button"]').every(button => button.classes().includes('max-h-[80vh]'))).toBe(true)
    expect(section.find('h2').exists()).toBe(false)
    expect(section.find('p').exists()).toBe(false)
  })

  it('keeps the media column larger on desktop for both left and right text positions', async () => {
    mockDesktopMedia()
    const wrapper = mountLayout({
      exhibition: {
        ...exhibition,
        sections: [
          {
            id: 'left-text-gallery',
            layout: 'media',
            theme: 'white',
            title: 'Left Text',
            body: '',
            photoIds: ['1', '2'],
            textPosition: 'left',
            reserveTextSpace: false,
          },
          {
            id: 'right-text-gallery',
            layout: 'media',
            theme: 'white',
            title: 'Right Text',
            body: '',
            photoIds: ['1', '2'],
            textPosition: 'right',
            reserveTextSpace: false,
          },
        ],
      },
      exhibitionSectionPhotos: [
        { id: 'left-text-gallery', photos: [photo, photoB] },
        { id: 'right-text-gallery', photos: [photo, photoB] },
      ],
    })
    await nextTick()

    const leftTextSection = wrapper.find('[data-test="exhibition-swiper"] [data-test="exhibition-section-left-text-gallery"]')
    const rightTextSection = wrapper.find('[data-test="exhibition-swiper"] [data-test="exhibition-section-right-text-gallery"]')

    expect(leftTextSection.find('.lg\\:grid-cols-\\[minmax\\(320px\\,0\\.75fr\\)_minmax\\(0\\,0\\.95fr\\)\\]').exists()).toBe(true)
    expect(rightTextSection.find('.lg\\:grid-cols-\\[minmax\\(0\\,0\\.95fr\\)_minmax\\(320px\\,0\\.75fr\\)\\]').exists()).toBe(true)
  })

  it('renders media bottom text only when present', () => {
    const wrapper = mountLayout({
      exhibition: {
        ...exhibition,
        sections: [
          {
            id: 'annotated-single',
            layout: 'media',
            theme: 'white',
            title: '',
            body: 'Archival inkjet print, 2026.',
            photoIds: ['1'],
            textPosition: 'bottom',
            reserveTextSpace: false,
          },
          {
            id: 'plain-single',
            layout: 'media',
            theme: 'white',
            title: '',
            body: '',
            photoIds: ['2'],
            textPosition: 'none',
            reserveTextSpace: false,
          },
        ],
      },
      exhibitionSectionPhotos: [
        { id: 'annotated-single', photos: [photo] },
        { id: 'plain-single', photos: [photoB] },
      ],
    })

    expect(wrapper.find('[data-test="exhibition-section-annotated-single"]').text()).toContain('Archival inkjet print, 2026.')
    expect(wrapper.find('[data-test="exhibition-section-plain-single"]').text()).not.toContain('Archival inkjet print, 2026.')
  })

  it('renders section body text with compact line spacing, manual line breaks, and full container width', () => {
    const wrapper = mountLayout({
      exhibition: {
        ...exhibition,
        sections: [
          {
            id: 'manual-copy',
            layout: 'media',
            theme: 'white',
            title: 'Manual Copy',
            body: 'First line\nSecond line',
            photoIds: ['1'],
            textPosition: 'right',
            reserveTextSpace: false,
          },
        ],
      },
      exhibitionSectionPhotos: [{ id: 'manual-copy', photos: [photo] }],
    })

    const section = wrapper.find('[data-test="exhibition-mobile-flow"] [data-test="exhibition-section-manual-copy"]')
    const textContainer = section.find('[data-test="exhibition-text"]')
    const body = section.find('[data-test="exhibition-body"]')

    expect(textContainer.classes()).not.toContain('max-w-2xl')
    expect(textContainer.classes()).toContain('w-full')
    expect(textContainer.classes()).toContain('max-w-full')
    expect(body.text()).toContain('First line')
    expect(body.text()).toContain('Second line')
    expect(body.classes()).toContain('whitespace-pre-line')
    expect(body.classes()).toContain('leading-6')
    expect(body.classes()).not.toContain('leading-8')
  })

  it('left-aligns mobile media section text for side and bottom text positions while keeping text-only sections centered', () => {
    const wrapper = mountLayout({
      exhibition: {
        ...exhibition,
        sections: [
          {
            id: 'left-media',
            layout: 'media',
            theme: 'white',
            title: 'Left Media',
            body: 'Side text',
            photoIds: ['1'],
            textPosition: 'left',
            reserveTextSpace: false,
          },
          {
            id: 'right-media',
            layout: 'media',
            theme: 'white',
            title: 'Right Media',
            body: 'Side text',
            photoIds: ['1'],
            textPosition: 'right',
            reserveTextSpace: false,
          },
          {
            id: 'bottom-media',
            layout: 'media',
            theme: 'white',
            title: 'Bottom Media',
            body: 'Bottom text',
            photoIds: ['1'],
            textPosition: 'bottom',
            reserveTextSpace: false,
          },
          {
            id: 'text-only',
            layout: 'text',
            theme: 'white',
            title: 'Text Only',
            body: 'Centered text',
            photoIds: [],
            textPosition: 'none',
            reserveTextSpace: false,
          },
        ],
      },
      exhibitionSectionPhotos: [
        { id: 'left-media', photos: [photo] },
        { id: 'right-media', photos: [photo] },
        { id: 'bottom-media', photos: [photo] },
        { id: 'text-only', photos: [] },
      ],
    })

    const mobileFlow = wrapper.find('[data-test="exhibition-mobile-flow"]')
    const leftText = mobileFlow.find('[data-test="exhibition-section-left-media"] [data-test="exhibition-text"]')
    const rightText = mobileFlow.find('[data-test="exhibition-section-right-media"] [data-test="exhibition-text"]')
    const bottomText = mobileFlow.find('[data-test="exhibition-section-bottom-media"] [data-test="exhibition-text"]')
    const textOnly = mobileFlow.find('[data-test="exhibition-section-text-only"] [data-test="exhibition-text"]')

    expect(leftText.classes()).not.toContain('text-center')
    expect(rightText.classes()).not.toContain('text-center')
    expect(bottomText.classes()).not.toContain('text-center')
    expect(textOnly.classes()).toContain('text-center')
  })

  it('applies configured desktop and mobile section text alignment independently', async () => {
    mockDesktopMedia()
    const wrapper = mountLayout({
      exhibition: {
        ...exhibition,
        sections: [
          {
            id: 'configured-align',
            layout: 'media',
            theme: 'white',
            title: 'Configured Align',
            body: 'Alignment body',
            photoIds: ['1'],
            textPosition: 'right',
            desktopTextAlign: 'right',
            mobileTextAlign: 'center',
            reserveTextSpace: false,
          },
        ],
      },
      exhibitionSectionPhotos: [{ id: 'configured-align', photos: [photo] }],
    })
    await nextTick()

    const mobileText = wrapper.find('[data-test="exhibition-mobile-flow"] [data-test="exhibition-section-configured-align"] [data-test="exhibition-text"]')
    const desktopText = wrapper.find('[data-test="exhibition-swiper"] [data-test="exhibition-section-configured-align"] [data-test="exhibition-text"]')

    expect(mobileText.classes()).toContain('text-center')
    expect(mobileText.classes()).not.toContain('text-right')
    expect(desktopText.classes()).toContain('text-right')
    expect(desktopText.classes()).not.toContain('text-center')
  })

  it('emits selected gallery photos in response to direct image clicks', async () => {
    const wrapper = mountLayout({
      exhibition: {
        ...exhibition,
        sections: [
          {
            id: 'gallery-section',
            layout: 'media',
            theme: 'white',
            title: '',
            body: '',
            photoIds: ['1', '2'],
            textPosition: 'none',
            reserveTextSpace: false,
          },
        ],
      },
      exhibitionSectionPhotos: [{ id: 'gallery-section', photos: [photo, photoB] }],
    })

    await wrapper.findAll('[data-test="exhibition-photo-button"]')[1]?.trigger('click')

    expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({ photo: photoB, mode: 'fade' })
  })
})
