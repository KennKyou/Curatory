export const CSRF_PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const
export const CSRF_PROTECTED_ADMIN_PREFIXES = ['/api/platform', '/api/s3', '/api/user'] as const

interface CsrfRequestInput {
  method?: string
  path: string
  origin?: string
  referer?: string
  host?: string
  forwardedHost?: string
  forwardedProto?: string
  nodeEnv?: string
}

interface CsrfValidationResult {
  valid: boolean
  reason?: 'unprotected' | 'missing-origin' | 'origin-mismatch' | 'missing-host'
}

export function isCsrfProtectedMethod(method?: string): boolean {
  if (!method) return false
  return CSRF_PROTECTED_METHODS.includes(method.toUpperCase() as typeof CSRF_PROTECTED_METHODS[number])
}

export function isCsrfProtectedAdminPath(path: string): boolean {
  return CSRF_PROTECTED_ADMIN_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
}

function normalizeOrigin(value?: string): string | null {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function originFromReferer(value?: string): string | null {
  return normalizeOrigin(value)
}

function expectedRequestOrigin(input: CsrfRequestInput): string | null {
  const host = input.host || input.forwardedHost
  if (!host) return null

  const proto = input.forwardedProto || (input.nodeEnv === 'production' ? 'https' : 'http')
  return `${proto}://${host}`
}

export function validateCsrfRequest(input: CsrfRequestInput): CsrfValidationResult {
  if (!isCsrfProtectedMethod(input.method) || !isCsrfProtectedAdminPath(input.path)) {
    return { valid: true, reason: 'unprotected' }
  }

  const expectedOrigin = expectedRequestOrigin(input)
  if (!expectedOrigin) return { valid: false, reason: 'missing-host' }

  const sourceOrigin = normalizeOrigin(input.origin) || originFromReferer(input.referer)
  if (!sourceOrigin) return { valid: false, reason: 'missing-origin' }

  if (sourceOrigin !== expectedOrigin) return { valid: false, reason: 'origin-mismatch' }

  return { valid: true }
}
