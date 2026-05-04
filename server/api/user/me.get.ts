import { User } from '~~/server/models/User'
import type { UserMeResponse } from '~~/server/types/api'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user) {
    return null
  }

  const user = await User.findById(session.user.id).lean()
  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    isAdmin: true,
  } satisfies UserMeResponse
})
