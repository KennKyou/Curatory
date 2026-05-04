import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PhotoGrid from '~/app/components/PhotoGrid.vue'

const photos = [
  {
    id: '1',
    url: 'https://example.com/1.jpg',
    thumbnailUrl: null,
    key: 'travel/1.jpg',
    slug: 'photo-1',
    size: 1024,
    width: 800,
    height: 600,
    blurDataUrl: null,
  },
  {
    id: '2',
    url: 'https://example.com/2.jpg',
    thumbnailUrl: 'https://example.com/2-thumb.jpg',
    key: 'food/2.jpg',
    slug: 'photo-2',
    size: 2048,
    width: 600,
    height: 800,
    blurDataUrl: null,
  },
]

function mountGrid(overrides = {}) {
  return mount(PhotoGrid, {
    props: {
      photos,
      selectedIds: new Set<string>(),
      hasMore: false,
      loading: false,
      ...overrides,
    },
    global: {
      stubs: {
        Icon: { template: '<span />' },
      },
    },
  })
}

describe('PhotoGrid', () => {
  it('renders photos', () => {
    const wrapper = mountGrid()
    const images = wrapper.findAll('img')

    // Should render at least the photo images
    expect(images.length).toBeGreaterThanOrEqual(2)
  })

  it('emits toggleSelect with photo id on click', async () => {
    const wrapper = mountGrid()

    // Find clickable photo container (div with cursor-pointer)
    const photoContainers = wrapper.findAll('.cursor-pointer')
    expect(photoContainers.length).toBeGreaterThan(0)

    await photoContainers[0].trigger('click')

    const events = wrapper.emitted('toggleSelect')
    expect(events).toBeDefined()
    // Should emit one of the photo ids
    expect(['1', '2']).toContain(events![0][0])
  })

  it('applies ring class to selected photos', () => {
    const wrapper = mountGrid({
      selectedIds: new Set(['1']),
    })

    const selectedEl = wrapper.findAll('.ring-2')
    expect(selectedEl.length).toBeGreaterThan(0)
  })
})
