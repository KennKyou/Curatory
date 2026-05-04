const STORAGE_KEY = 'photo-reactions:fingerprintId'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function getOrCreateFingerprintId(): string {
  if (typeof window === 'undefined') {
    throw new Error('getOrCreateFingerprintId must run on the client')
  }

  const existing = window.localStorage.getItem(STORAGE_KEY)
  if (existing && UUID_PATTERN.test(existing)) {
    return existing
  }

  const fresh = crypto.randomUUID()
  window.localStorage.setItem(STORAGE_KEY, fresh)
  return fresh
}
