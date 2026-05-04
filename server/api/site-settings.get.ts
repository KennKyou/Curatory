import { SiteSettings } from '~~/server/models/SiteSettings'
import { User } from '~~/server/models/User'
import { Photo } from '~~/server/models/Photo'
import { normalizeExhibitionSettings, type SiteSettingsResponse } from '~~/server/types/api'

export default defineEventHandler(async () => {
  const settings = await SiteSettings.findOne().lean()
  const adminUser = settings?.userId
    ? await User.findById(settings.userId, { avatar: 1 }).lean()
    : await User.findOne({}, { avatar: 1 }).sort({ createdAt: 1 }).lean()
  const exhibition = normalizeExhibitionSettings(settings?.exhibition)
  const exhibitionCoverPhoto = settings?.userId && exhibition.coverPhotoId
    ? await Photo.findOne(
        { _id: exhibition.coverPhotoId, userId: settings.userId },
        { url: 1, thumbnailUrl: 1 },
      ).lean()
    : null

  return {
    siteName: settings?.siteName || '',
    homePageTitle: settings?.homePageTitle || '',
    siteDescription: settings?.siteDescription || '',
    siteUrl: settings?.siteUrl || '',
    socialLinks: {
      website: settings?.socialLinks?.website || '',
      github: settings?.socialLinks?.github || '',
      facebook: settings?.socialLinks?.facebook || '',
      instagram: settings?.socialLinks?.instagram || '',
      threads: settings?.socialLinks?.threads || '',
      x: settings?.socialLinks?.x || '',
      email: settings?.socialLinks?.email || '',
    },
    authorName: settings?.authorName || '',
    avatarUrl: adminUser?.avatar || '',
    showGpsInfo: false,
    showRssLink: false,
    exhibition,
    exhibitionCoverPhoto: exhibitionCoverPhoto
      ? {
          id: exhibitionCoverPhoto._id.toString(),
          url: exhibitionCoverPhoto.url,
          thumbnailUrl: exhibitionCoverPhoto.thumbnailUrl,
        }
      : null,
  } satisfies SiteSettingsResponse
})
