import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getOrCreateFingerprintId } from '~/app/utils/fingerprint'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const STORAGE_KEY = 'photo-reactions:fingerprintId'

function fakeCrypto() {
  let counter = 0
  return {
    randomUUID: vi.fn(() => {
      counter++
      const hex = counter.toString(16).padStart(12, '0')
      return `00000000-0000-4000-8000-${hex}`
    }),
  }
}

describe('getOrCreateFingerprintId', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.stubGlobal('crypto', fakeCrypto())
  })

  it('generates a fresh UUID on first call and persists it', () => {
    const id = getOrCreateFingerprintId()
    expect(id).toMatch(UUID_V4)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(id)
  })

  it('returns the same UUID across repeated calls within a session', () => {
    const first = getOrCreateFingerprintId()
    const second = getOrCreateFingerprintId()
    expect(second).toBe(first)
  })

  it('reuses a previously persisted UUID', () => {
    const existing = '11111111-2222-4333-8444-555555555555'
    window.localStorage.setItem(STORAGE_KEY, existing)
    expect(getOrCreateFingerprintId()).toBe(existing)
  })

  it('regenerates when the stored value is not a valid UUID', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not-a-uuid')
    const id = getOrCreateFingerprintId()
    expect(id).toMatch(UUID_V4)
    expect(id).not.toBe('not-a-uuid')
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(id)
  })
})
