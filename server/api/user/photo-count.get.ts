import { Photo } from '~~/server/models/Photo'
import type { UserPhotoCountResponse } from '~~/server/types/api'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const count = await Photo.countDocuments({ userId: session.user.id })
  return { count } satisfies UserPhotoCountResponse
})
