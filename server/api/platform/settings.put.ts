import mongoose from 'mongoose'
import { Photo } from '~~/server/models/Photo'
import { SiteSettings } from '~~/server/models/SiteSettings'
import {
  isExhibitionCoverTextColor,
  isExhibitionCoverProtection,
  isExhibitionSectionLayout,
  isExhibitionSectionTextAlign,
  isExhibitionSectionTextPosition,
  isExhibitionSectionTheme,
  isExhibitionTheme,
  getDefaultExhibitionSectionTextAlign,
  normalizeExhibitionSettings,
  type PlatformSettingsResponse,
} from '~~/server/types/api'

function validateUrl(value: string): boolean {
  if (value === '') return true
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function validateEmail(value: string): boolean {
  if (value === '') return true
  const atIndex = value.indexOf('@')
  return atIndex > 0 && value.indexOf('.', atIndex) > atIndex + 1
}

function parsePhotoId(value: unknown, field: string): mongoose.Types.ObjectId {
  if (typeof value !== 'string' || !/^[0-9a-fA-F]{24}$/.test(value) || !mongoose.Types.ObjectId.isValid(value)) {
    throw createError({ statusCode: 400, message: `Invalid ${field}` })
  }
  return new mongoose.Types.ObjectId(value)
}

function validateExhibitionSectionPhotoCount(layout: string, photoCount: number) {
  if (layout === 'media' && (photoCount < 1 || photoCount > 4)) {
    throw createError({ statusCode: 400, message: 'Invalid exhibition' })
  }
  if (layout === 'text' && photoCount !== 0) {
    throw createError({ statusCode: 400, message: 'Invalid exhibition' })
  }
}

function parseOptionalString(value: unknown, fieldPresent: boolean) {
  if (!fieldPresent) return ''
  if (typeof value !== 'string') {
    throw createError({ statusCode: 400, message: 'Invalid exhibition' })
  }
  return value
}

async function ensureOwnedPhotos(userId: mongoose.Types.ObjectId, ids: mongoose.Types.ObjectId[], field: string) {
  if (ids.length === 0) return
  const ownedCount = await Photo.countDocuments({ userId, _id: { $in: ids } })
  if (ownedCount !== new Set(ids.map(id => id.toString())).size) {
    throw createError({ statusCode: 400, message: `Invalid ${field}` })
  }
}

async function parseExhibitionSettings(userId: mongoose.Types.ObjectId, value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createError({ statusCode: 400, message: 'Invalid exhibition' })
  }
  const source = value as Record<string, any>
  let coverPhotoId: mongoose.Types.ObjectId | null = null
  if (source.coverPhotoId !== undefined && source.coverPhotoId !== null) {
    coverPhotoId = parsePhotoId(source.coverPhotoId, 'exhibition.coverPhotoId')
  }

  if (source.coverTextColor !== undefined && !isExhibitionCoverTextColor(source.coverTextColor)) {
    throw createError({ statusCode: 400, message: 'Invalid exhibition' })
  }
  if (source.coverProtection !== undefined && !isExhibitionCoverProtection(source.coverProtection)) {
    throw createError({ statusCode: 400, message: 'Invalid exhibition' })
  }
  if (source.theme !== undefined && !isExhibitionTheme(source.theme)) {
    throw createError({ statusCode: 400, message: 'Invalid exhibition' })
  }
  if (source.sections !== undefined && !Array.isArray(source.sections)) {
    throw createError({ statusCode: 400, message: 'Invalid exhibition' })
  }

  const sections = (source.sections ?? []).map((section: unknown) => {
    if (!section || typeof section !== 'object' || Array.isArray(section)) {
      throw createError({ statusCode: 400, message: 'Invalid exhibition' })
    }
    const sectionSource = section as Record<string, any>
    if (typeof sectionSource.id !== 'string' || !sectionSource.id.trim()) {
      throw createError({ statusCode: 400, message: 'Invalid exhibition' })
    }
    if (sectionSource.layout !== undefined && !isExhibitionSectionLayout(sectionSource.layout)) {
      throw createError({ statusCode: 400, message: 'Invalid exhibition' })
    }
    if (sectionSource.theme !== undefined && !isExhibitionSectionTheme(sectionSource.theme)) {
      throw createError({ statusCode: 400, message: 'Invalid exhibition' })
    }
    if (sectionSource.textPosition !== undefined && !isExhibitionSectionTextPosition(sectionSource.textPosition)) {
      throw createError({ statusCode: 400, message: 'Invalid exhibition' })
    }
    if (sectionSource.desktopTextAlign !== undefined && !isExhibitionSectionTextAlign(sectionSource.desktopTextAlign)) {
      throw createError({ statusCode: 400, message: 'Invalid exhibition' })
    }
    if (sectionSource.mobileTextAlign !== undefined && !isExhibitionSectionTextAlign(sectionSource.mobileTextAlign)) {
      throw createError({ statusCode: 400, message: 'Invalid exhibition' })
    }
    if (sectionSource.reserveTextSpace !== undefined && typeof sectionSource.reserveTextSpace !== 'boolean') {
      throw createError({ statusCode: 400, message: 'Invalid exhibition' })
    }
    if (sectionSource.photoIds !== undefined && !Array.isArray(sectionSource.photoIds)) {
      throw createError({ statusCode: 400, message: 'Invalid exhibition' })
    }
    const layout = sectionSource.layout ?? 'media'
    const defaultTextAlign = getDefaultExhibitionSectionTextAlign(layout)
    const photoIds = (sectionSource.photoIds ?? []).map((id: unknown) => parsePhotoId(id, 'exhibition.photoIds'))
    validateExhibitionSectionPhotoCount(layout, photoIds.length)

    return {
      id: sectionSource.id,
      layout,
      theme: sectionSource.theme ?? 'white',
      title: parseOptionalString(sectionSource.title, 'title' in sectionSource),
      body: parseOptionalString(sectionSource.body, 'body' in sectionSource),
      photoIds,
      textPosition: sectionSource.textPosition ?? 'none',
      desktopTextAlign: sectionSource.desktopTextAlign ?? defaultTextAlign,
      mobileTextAlign: sectionSource.mobileTextAlign ?? defaultTextAlign,
      reserveTextSpace: sectionSource.reserveTextSpace ?? false,
    }
  })

  const ids = [
    ...(coverPhotoId ? [coverPhotoId] : []),
    ...sections.flatMap(section => section.photoIds),
  ]
  await ensureOwnedPhotos(userId, ids, coverPhotoId ? 'exhibition.coverPhotoId' : 'exhibition.photoIds')

  return {
    coverPhotoId,
    title: typeof source.title === 'string' ? source.title : '',
    subtitle: typeof source.subtitle === 'string' ? source.subtitle : '',
    description: typeof source.description === 'string' ? source.description : '',
    startDate: typeof source.startDate === 'string' && source.startDate ? source.startDate : null,
    endDate: typeof source.endDate === 'string' && source.endDate ? source.endDate : null,
    theme: source.theme ?? 'white',
    coverTextColor: source.coverTextColor ?? 'white',
    coverProtection: source.coverProtection ?? 'auto',
    sections,
  }
}

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = new mongoose.Types.ObjectId(session.user.id)
  const body = await readBody(event)

  const allowedFields = [
    'siteName', 'homePageTitle', 'siteDescription', 'siteUrl',
    'socialLinks', 'authorName',
    'exhibition',
  ]

  const urlFields = ['siteUrl']
  const socialUrlFields = ['website', 'github', 'facebook', 'instagram', 'threads', 'x']

  const update: Record<string, any> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === 'socialLinks') {
        const allowedLinks = ['website', 'github', 'facebook', 'instagram', 'threads', 'x', 'email']
        const links: Record<string, string> = {}
        for (const key of allowedLinks) {
          if (body.socialLinks[key] !== undefined) {
            const val = String(body.socialLinks[key])
            if (key === 'email') {
              if (!validateEmail(val)) {
                throw createError({ statusCode: 400, message: `Invalid email: socialLinks.email` })
              }
            } else if (socialUrlFields.includes(key)) {
              if (!validateUrl(val)) {
                throw createError({ statusCode: 400, message: `Invalid URL: socialLinks.${key}` })
              }
            }
            links[`socialLinks.${key}`] = val
          }
        }
        Object.assign(update, links)
      } else if (field === 'exhibition') {
        update[field] = await parseExhibitionSettings(userId, body[field])
      } else {
        const val = String(body[field])
        if (urlFields.includes(field) && !validateUrl(val)) {
          throw createError({ statusCode: 400, message: `Invalid URL: ${field}` })
        }
        update[field] = val
      }
    }
  }

  const settings = await SiteSettings.findOneAndUpdate(
    { userId },
    { $set: update },
    { upsert: true, returnDocument: 'after', lean: true },
  )

  return {
    siteName: settings.siteName || '',
    homePageTitle: settings.homePageTitle || '',
    siteDescription: settings.siteDescription || '',
    siteUrl: settings.siteUrl || '',
    socialLinks: {
      website: settings.socialLinks?.website || '',
      github: settings.socialLinks?.github || '',
      facebook: settings.socialLinks?.facebook || '',
      instagram: settings.socialLinks?.instagram || '',
      threads: settings.socialLinks?.threads || '',
      x: settings.socialLinks?.x || '',
      email: settings.socialLinks?.email || '',
    },
    authorName: settings.authorName || '',
    storageQuota: settings.storageQuota || 0,
    showGpsInfo: false,
    showRssLink: false,
    exhibition: normalizeExhibitionSettings(settings.exhibition),
  } satisfies PlatformSettingsResponse
})
