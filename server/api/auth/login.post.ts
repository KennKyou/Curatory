import { User } from '~~/server/models/User'
import { normalizeAuthEmail } from '~~/server/utils/authAllowlist'
import { verifyLocalPassword } from '~~/server/utils/localPassword'
import { verifyTurnstileToken } from '~~/server/utils/turnstile'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  await verifyTurnstileToken(event, body?.turnstileToken)
  const email = normalizeAuthEmail(body?.email)
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Invalid credentials' })
  }

  const user = await User.findOne({ email })
  if (!user || !await verifyLocalPassword(password, user.passwordHash)) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  await setUserSession(event, {
    user: {
      id: user._id!.toString(),
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    },
  })

  return { ok: true }
})
