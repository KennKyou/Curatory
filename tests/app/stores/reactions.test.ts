import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useReactionsStore } from '~/app/stores/reactions'

const FINGERPRINT = '11111111-2222-4333-8444-555555555555'
const STORAGE_KEY = 'photo-reactions:fingerprintId'

describe('reactions store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.localStorage.clear()
    window.localStorage.setItem(STORAGE_KEY, FINGERPRINT)
    vi.restoreAllMocks()
  })

  it('init populates mine from GET /reactions/mine', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      reactions: [
        { photoSlug: 'p1', emoji: 'fire' },
        { photoSlug: 'p1', emoji: 'heartEyes' },
        { photoSlug: 'p2', emoji: 'thumbsUp' },
      ],
    })
    vi.stubGlobal('$fetch', fetchMock)

    const store = useReactionsStore()
    await store.init()

    expect(fetchMock).toHaveBeenCalledWith('/api/photos/reactions/mine', {
      query: { fingerprintId: FINGERPRINT },
    })
    expect(store.hasReacted('p1', 'fire')).toBe(true)
    expect(store.hasReacted('p1', 'heartEyes')).toBe(true)
    expect(store.hasReacted('p2', 'thumbsUp')).toBe(true)
    expect(store.hasReacted('p2', 'fire')).toBe(false)
    expect(store.initialized).toBe(true)
  })

  it('init is idempotent — second call is a no-op', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ reactions: [] })
    vi.stubGlobal('$fetch', fetchMock)

    const store = useReactionsStore()
    await store.init()
    await store.init()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('toggleReaction optimistically flips mine and commits on success', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ reactions: [] })
      .mockResolvedValueOnce({
        action: 'added',
        reactionCounts: { heartEyes: 0, starStruck: 0, thumbsUp: 0, fire: 1, raisedHands: 0, camera: 0 },
        topReaction: 'fire',
        reactionTotal: 1,
      })
    vi.stubGlobal('$fetch', fetchMock)

    const store = useReactionsStore()
    await store.init()

    expect(store.hasReacted('p1', 'fire')).toBe(false)
    const result = await store.toggleReaction('p1', 'fire')
    expect(store.hasReacted('p1', 'fire')).toBe(true)
    expect(result?.action).toBe('added')
  })

  it('toggleReaction rolls back on failure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ reactions: [] })
      .mockRejectedValueOnce(new Error('boom'))
    vi.stubGlobal('$fetch', fetchMock)

    const store = useReactionsStore()
    await store.init()

    await expect(store.toggleReaction('p1', 'fire')).rejects.toThrow('boom')
    expect(store.hasReacted('p1', 'fire')).toBe(false)
  })

  it('toggleReaction removes reaction when already active and server confirms removal', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        reactions: [{ photoSlug: 'p1', emoji: 'fire' }],
      })
      .mockResolvedValueOnce({
        action: 'removed',
        reactionCounts: { heartEyes: 0, starStruck: 0, thumbsUp: 0, fire: 0, raisedHands: 0, camera: 0 },
        topReaction: null,
        reactionTotal: 0,
      })
    vi.stubGlobal('$fetch', fetchMock)

    const store = useReactionsStore()
    await store.init()
    expect(store.hasReacted('p1', 'fire')).toBe(true)

    await store.toggleReaction('p1', 'fire')
    expect(store.hasReacted('p1', 'fire')).toBe(false)
  })

  it('toggleReaction debounces concurrent clicks on same slug+emoji', async () => {
    let resolveFirst!: (v: any) => void
    const slowResponse = new Promise((resolve) => { resolveFirst = resolve })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ reactions: [] })
      .mockReturnValueOnce(slowResponse)
    vi.stubGlobal('$fetch', fetchMock)

    const store = useReactionsStore()
    await store.init()

    const first = store.toggleReaction('p1', 'fire')
    const second = await store.toggleReaction('p1', 'fire')
    expect(second).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)

    resolveFirst({
      action: 'added',
      reactionCounts: { heartEyes: 0, starStruck: 0, thumbsUp: 0, fire: 1, raisedHands: 0, camera: 0 },
      topReaction: 'fire',
      reactionTotal: 1,
    })
    await first
  })

  it('isBusy reflects in-flight state for exact slug+emoji pair', async () => {
    let resolveIt!: (v: any) => void
    const slow = new Promise((r) => { resolveIt = r })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ reactions: [] })
      .mockReturnValueOnce(slow)
    vi.stubGlobal('$fetch', fetchMock)

    const store = useReactionsStore()
    await store.init()

    const pending = store.toggleReaction('p1', 'fire')
    expect(store.isBusy('p1', 'fire')).toBe(true)
    expect(store.isBusy('p1', 'heartEyes')).toBe(false)
    expect(store.isBusy('p2', 'fire')).toBe(false)

    resolveIt({
      action: 'added',
      reactionCounts: { heartEyes: 0, starStruck: 0, thumbsUp: 0, fire: 1, raisedHands: 0, camera: 0 },
      topReaction: 'fire',
      reactionTotal: 1,
    })
    await pending
    expect(store.isBusy('p1', 'fire')).toBe(false)
  })
})
