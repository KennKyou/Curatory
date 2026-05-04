import { SiteSettings } from '~~/server/models/SiteSettings'
import { User } from '~~/server/models/User'

export async function getPublicOwnerUser() {
  const settings = await SiteSettings.findOne({}, { userId: 1 }).lean()
  if (settings?.userId) {
    const user = await User.findById(settings.userId).lean()
    if (user) return user
  }
  return User.findOne().sort({ createdAt: 1 }).lean()
}
