import mongoose from 'mongoose'
import { SiteSettings } from '~~/server/models/SiteSettings'
import { defaultExhibitionSettings, normalizeExhibitionSettings, type PlatformSettingsResponse } from '~~/server/types/api'

const DEFAULT_SETTINGS: PlatformSettingsResponse = {
  siteName: '',
  homePageTitle: '',
  siteDescription: '',
  siteUrl: '',
  socialLinks: {
    website: '',
    github: '',
    facebook: '',
    instagram: '',
    threads: '',
    x: '',
    email: '',
  },
  authorName: '',
  avatarUrl: '',
  storageQuota: 0,
  showGpsInfo: false,
  showRssLink: false,
  exhibition: defaultExhibitionSettings(),
}

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = new mongoose.Types.ObjectId(session.user.id)

  const settings = await SiteSettings.findOne({ userId }).lean()
  if (!settings) return DEFAULT_SETTINGS

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
    avatarUrl: '',
    storageQuota: settings.storageQuota || 0,
    showGpsInfo: false,
    showRssLink: false,
    exhibition: normalizeExhibitionSettings(settings.exhibition),
  } satisfies PlatformSettingsResponse
})
