// In-memory rate limiter — single instance only.
// For multi-instance deployments, replace with Redis or shared store.

interface RateLimitEntry {
  count: number
  windowStart: number
}

const store = new Map<string, RateLimitEntry>()

const WINDOW_MS = 60_000
const CLEANUP_INTERVAL_MS = 60_000
const STALE_MS = 120_000

const ADMIN_PREFIXES = ['/api/platform/', '/api/s3/', '/api/user/']
const OG_PREFIX = '/api/og/'
const AUTH_PREFIX = '/api/auth/'
const ADMIN_LIMIT = 30
const PUBLIC_LIMIT = 60
const OG_LIMIT = 10
const AUTH_LIMIT = 10

function getClientIp(event: any): string {
  const forwarded = getRequestHeader(event, 'x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return getRequestIP(event) || 'unknown'
}

function isAdminApi(path: string): boolean {
  return ADMIN_PREFIXES.some(prefix => path.startsWith(prefix))
}

// Periodic cleanup of stale entries
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now - entry.windowStart > STALE_MS) {
      store.delete(key)
    }
  }
}, CLEANUP_INTERVAL_MS)

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/')) return

  const ip = getClientIp(event)
  const isOg = path.startsWith(OG_PREFIX)
  const isAuth = path.startsWith(AUTH_PREFIX)
  const isAdmin = isAdminApi(path)
  const limit = isAuth ? AUTH_LIMIT : isOg ? OG_LIMIT : isAdmin ? ADMIN_LIMIT : PUBLIC_LIMIT
  const now = Date.now()
  const bucket = isAuth ? 'auth' : isOg ? 'og' : isAdmin ? 'admin' : 'public'
  const key = `${ip}:${bucket}`

  let entry = store.get(key)
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    entry = { count: 0, windowStart: now }
    store.set(key, entry)
  }

  entry.count++

  setResponseHeader(event, 'X-RateLimit-Limit', String(limit))
  setResponseHeader(event, 'X-RateLimit-Remaining', String(Math.max(0, limit - entry.count)))

  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000)
    setResponseHeader(event, 'Retry-After', retryAfter)
    throw createError({ statusCode: 429, message: 'Too Many Requests' })
  }
})
