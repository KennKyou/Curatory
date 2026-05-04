export function normalizeAuthEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function getAllowedAuthEmails(): Set<string> {
  const config = useRuntimeConfig()
  const raw = String(config.authAllowedEmails || '')
  return new Set(
    raw
      .split(/[\s,;]+/)
      .map(email => normalizeAuthEmail(email))
      .filter(Boolean),
  )
}

export function assertEmailCanRegister(email: string) {
  const allowed = getAllowedAuthEmails()
  if (!allowed.has(normalizeAuthEmail(email))) {
    throw createError({ statusCode: 403, message: 'Email is not allowed to register' })
  }
}
