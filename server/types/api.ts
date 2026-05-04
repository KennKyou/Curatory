// Shared response types for server API handlers.
// Handlers lock their return shape with `satisfies <Response>` so Nitro's
// Serialize<T> inference stays stable. Client consumers pass the same type
// as `useFetch<Response>(...)` to get precise types regardless of module
// inference quirks (mongoose lean + `any` would otherwise collapse keys).

export interface SocialLinks {
  website: string
  github: string
  facebook: string
  instagram: string
  threads: string
  x: string
  email: string
}

export const EXHIBITION_COVER_TEXT_COLORS = ['white', 'black'] as const
export type ExhibitionCoverTextColor = typeof EXHIBITION_COVER_TEXT_COLORS[number]

export const EXHIBITION_COVER_PROTECTIONS = ['auto', 'none', 'soft', 'medium', 'strong'] as const
export type ExhibitionCoverProtection = typeof EXHIBITION_COVER_PROTECTIONS[number]

export const EXHIBITION_THEMES = ['white', 'black'] as const
export type ExhibitionTheme = typeof EXHIBITION_THEMES[number]

export const EXHIBITION_SECTION_LAYOUTS = ['media', 'text'] as const
export type ExhibitionSectionLayout = typeof EXHIBITION_SECTION_LAYOUTS[number]

export const LEGACY_EXHIBITION_SECTION_LAYOUTS = ['single-image', 'image-text', 'text-image', 'gallery'] as const
export type LegacyExhibitionSectionLayout = typeof LEGACY_EXHIBITION_SECTION_LAYOUTS[number]

export const EXHIBITION_SECTION_THEMES = ['white', 'black'] as const
export type ExhibitionSectionTheme = typeof EXHIBITION_SECTION_THEMES[number]

export const EXHIBITION_SECTION_TEXT_POSITIONS = ['none', 'left', 'right', 'bottom'] as const
export type ExhibitionSectionTextPosition = typeof EXHIBITION_SECTION_TEXT_POSITIONS[number]

export const EXHIBITION_SECTION_TEXT_ALIGNS = ['left', 'center', 'right'] as const
export type ExhibitionSectionTextAlign = typeof EXHIBITION_SECTION_TEXT_ALIGNS[number]

export function isExhibitionCoverTextColor(value: unknown): value is ExhibitionCoverTextColor {
  return typeof value === 'string' && (EXHIBITION_COVER_TEXT_COLORS as readonly string[]).includes(value)
}

export function isExhibitionCoverProtection(value: unknown): value is ExhibitionCoverProtection {
  return typeof value === 'string' && (EXHIBITION_COVER_PROTECTIONS as readonly string[]).includes(value)
}

export function isExhibitionTheme(value: unknown): value is ExhibitionTheme {
  return typeof value === 'string' && (EXHIBITION_THEMES as readonly string[]).includes(value)
}

export function isExhibitionSectionLayout(value: unknown): value is ExhibitionSectionLayout {
  return typeof value === 'string' && (EXHIBITION_SECTION_LAYOUTS as readonly string[]).includes(value)
}

export function isLegacyExhibitionSectionLayout(value: unknown): value is LegacyExhibitionSectionLayout {
  return typeof value === 'string' && (LEGACY_EXHIBITION_SECTION_LAYOUTS as readonly string[]).includes(value)
}

export function isExhibitionSectionTheme(value: unknown): value is ExhibitionSectionTheme {
  return typeof value === 'string' && (EXHIBITION_SECTION_THEMES as readonly string[]).includes(value)
}

export function isExhibitionSectionTextPosition(value: unknown): value is ExhibitionSectionTextPosition {
  return typeof value === 'string' && (EXHIBITION_SECTION_TEXT_POSITIONS as readonly string[]).includes(value)
}

export function isExhibitionSectionTextAlign(value: unknown): value is ExhibitionSectionTextAlign {
  return typeof value === 'string' && (EXHIBITION_SECTION_TEXT_ALIGNS as readonly string[]).includes(value)
}

function serializeMaybeId(value: unknown): string | null {
  return value && typeof (value as { toString: () => string }).toString === 'function'
    ? (value as { toString: () => string }).toString()
    : null
}

function serializeMaybeIds(value: unknown): string[] {
  return Array.isArray(value) ? value.map(serializeMaybeId).filter((id): id is string => Boolean(id)) : []
}

export interface ExhibitionSectionSettings {
  id: string
  layout: ExhibitionSectionLayout
  theme: ExhibitionSectionTheme
  title: string
  body: string
  photoIds: string[]
  textPosition: ExhibitionSectionTextPosition
  desktopTextAlign: ExhibitionSectionTextAlign
  mobileTextAlign: ExhibitionSectionTextAlign
  reserveTextSpace: boolean
}

export interface ExhibitionSettings {
  coverPhotoId: string | null
  title: string
  subtitle: string
  description: string
  startDate: string | null
  endDate: string | null
  theme: ExhibitionTheme
  coverTextColor: ExhibitionCoverTextColor
  coverProtection: ExhibitionCoverProtection
  sections: ExhibitionSectionSettings[]
}

export interface SiteSettingsExhibitionCoverPhoto {
  id: string
  url: string
  thumbnailUrl: string | null
}

export function defaultExhibitionSettings(): ExhibitionSettings {
  return {
    coverPhotoId: null,
    title: '',
    subtitle: '',
    description: '',
    startDate: null,
    endDate: null,
    theme: 'white',
    coverTextColor: 'white',
    coverProtection: 'auto',
    sections: [],
  }
}

export function getDefaultExhibitionSectionTextAlign(layout: ExhibitionSectionLayout): ExhibitionSectionTextAlign {
  return layout === 'text' ? 'center' : 'left'
}

export function normalizeExhibitionSettings(value: unknown): ExhibitionSettings {
  if (!value || typeof value !== 'object') return defaultExhibitionSettings()
  const source = value as Record<string, any>
  const sections = Array.isArray(source.sections)
    ? source.sections.map((section): ExhibitionSectionSettings | null => {
        if (!section || typeof section !== 'object') return null
        const sectionSource = section as Record<string, any>
        const id = typeof sectionSource.id === 'string' && sectionSource.id.trim() ? sectionSource.id : ''
        if (!id) return null
        const rawLayout = sectionSource.layout
        const layout = isExhibitionSectionLayout(rawLayout)
          ? rawLayout
          : isLegacyExhibitionSectionLayout(rawLayout)
            ? 'media'
            : 'media'
        const theme = isExhibitionSectionTheme(sectionSource.theme) ? sectionSource.theme : 'white'
        const title = typeof sectionSource.title === 'string' ? sectionSource.title : ''
        const rawBody = typeof sectionSource.body === 'string' ? sectionSource.body : ''
        const annotation = typeof sectionSource.annotation === 'string' ? sectionSource.annotation : ''
        const body = rawLayout === 'single-image' && annotation && !rawBody ? annotation : rawBody
        const textPosition = isExhibitionSectionTextPosition(sectionSource.textPosition)
          ? sectionSource.textPosition
          : rawLayout === 'text-image'
            ? 'left'
            : rawLayout === 'image-text'
              ? 'right'
              : rawLayout === 'single-image'
                ? annotation ? 'bottom' : 'none'
                : rawLayout === 'gallery'
                  ? title || body ? 'right' : 'none'
                  : layout === 'text'
                    ? 'none'
                  : 'none'
        const defaultTextAlign = getDefaultExhibitionSectionTextAlign(layout)
        return {
          id,
          layout,
          theme,
          title,
          body,
          photoIds: serializeMaybeIds(sectionSource.photoIds),
          textPosition,
          desktopTextAlign: isExhibitionSectionTextAlign(sectionSource.desktopTextAlign) ? sectionSource.desktopTextAlign : defaultTextAlign,
          mobileTextAlign: isExhibitionSectionTextAlign(sectionSource.mobileTextAlign) ? sectionSource.mobileTextAlign : defaultTextAlign,
          reserveTextSpace: typeof sectionSource.reserveTextSpace === 'boolean' ? sectionSource.reserveTextSpace : false,
        }
      }).filter((section): section is ExhibitionSectionSettings => Boolean(section))
    : []

  return {
    coverPhotoId: serializeMaybeId(source.coverPhotoId),
    title: typeof source.title === 'string' ? source.title : '',
    subtitle: typeof source.subtitle === 'string' ? source.subtitle : '',
    description: typeof source.description === 'string' ? source.description : '',
    startDate: typeof source.startDate === 'string' && source.startDate ? source.startDate : null,
    endDate: typeof source.endDate === 'string' && source.endDate ? source.endDate : null,
    theme: isExhibitionTheme(source.theme) ? source.theme : 'white',
    coverTextColor: isExhibitionCoverTextColor(source.coverTextColor) ? source.coverTextColor : 'white',
    coverProtection: isExhibitionCoverProtection(source.coverProtection) ? source.coverProtection : 'auto',
    sections,
  }
}

export interface SiteSettingsResponse {
  siteName: string
  homePageTitle: string
  siteDescription: string
  siteUrl: string
  socialLinks: SocialLinks
  authorName: string
  avatarUrl: string
  showGpsInfo: boolean
  showRssLink: boolean
  exhibition: ExhibitionSettings
  exhibitionCoverPhoto: SiteSettingsExhibitionCoverPhoto | null
}

export interface PlatformSettingsResponse {
  siteName: string
  homePageTitle: string
  siteDescription: string
  siteUrl: string
  socialLinks: SocialLinks
  authorName: string
  avatarUrl: string
  storageQuota: number
  showGpsInfo: boolean
  showRssLink: boolean
  exhibition: ExhibitionSettings
}

export interface UserMeResponse {
  id: string
  email: string
  name: string
  avatar: string
  isAdmin: boolean
}

export interface UserPhotoCountResponse {
  count: number
}

export interface PlatformOverviewRecentActivity {
  type: 'upload'
  name: string
  key: string
  slug: string
  thumbnailUrl: string | null
  size: number
  takenAt: string | null
  timestamp: string
}

export interface PlatformOverviewResponse {
  totalPhotos: number
  storageUsed: number
  averagePhotoSize: number
  uploadsThisMonth: number
  syncCompletion: number
  pending: number
  conflicts: number
  recentActivity: PlatformOverviewRecentActivity[]
}

export interface PlatformPhotoItem {
  id: string
  key: string
  url: string
  thumbnailUrl: string | null
  slug: string
  size: number
  width: number | null
  height: number | null
  blurDataUrl: string | null
}

export interface PlatformPhotosResponse {
  photos: PlatformPhotoItem[]
  hasMore: boolean
  lastId: string | null
}
