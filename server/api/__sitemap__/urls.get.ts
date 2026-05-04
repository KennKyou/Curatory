import { Photo } from '~~/server/models/Photo'
import { getPublicOwnerUser } from '~~/server/utils/publicOwner'

export default defineEventHandler(async () => {
  const user = await getPublicOwnerUser()
  if (!user) {
    return []
  }

  const photos = await Photo.find({ userId: user._id }, { slug: 1, createdAt: 1, thumbnailUrl: 1, url: 1 }).lean()

  return photos.map(photo => ({
    loc: `/photos/${photo.slug}`,
    lastmod: photo.createdAt,
    images: [{ loc: photo.thumbnailUrl || photo.url }],
  }))
})
