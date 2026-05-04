const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Accepts any RFC 4122 UUID (v1–v5). We do not enforce v4 strictly because
 * `crypto.randomUUID` produces v4 but some older browsers / polyfills emit v1.
 */
export function isValidFingerprintId(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4_PATTERN.test(value)
}
