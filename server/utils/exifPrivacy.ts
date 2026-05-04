/**
 * Remove the GPSInfo key from an EXIF object without mutating the input.
 * Used to filter GPS location data out of public API responses when the site
 * owner has disabled GPS exposure in SiteSettings.
 *
 * Returns a shallow clone with GPSInfo removed. Nested objects (Image, Photo,
 * etc.) are shared with the input because callers never mutate them.
 */
export function stripGpsFromExif<T extends Record<string, unknown>>(
  exif: T | null | undefined,
): T | null | undefined {
  if (exif == null) return exif
  const { GPSInfo: _omit, ...rest } = exif as Record<string, unknown>
  return rest as T
}
