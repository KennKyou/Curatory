import { User } from '~~/server/models/User'
import { assertEmailCanRegister, normalizeAuthEmail } from '~~/server/utils/authAllowlist'
import { hashLocalPassword } from '~~/server/utils/localPassword'
import { verifyTurnstileToken } from '~~/server/utils/turnstile'

function readCredentialBody(body: any) {
  const email = normalizeAuthEmail(body?.email)
  const password = typeof body?.password === 'string' ? body.password : ''
  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : email.split('@')[0]

  if (!email || !email.includes('@')) {
    throw createError({ statusCode: 400, message: 'Invalid email' })
  }
  if (password.length < 8) {
    throw createError({ statusCode: 400, message: 'Password must be at least 8 characters' })
  }

  return { email, password, name }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  await verifyTurnstileToken(event, body?.turnstileToken)
  const { email, password, name } = readCredentialBody(body)
  assertEmailCanRegister(email)

  const existing = await User.findOne({ email }).lean()
  if (existing) {
    throw createError({ statusCode: 409, message: 'Email already registered' })
  }

  const user = await User.create({
    email,
    passwordHash: await hashLocalPassword(password),
    name,
    avatar: '',
  })

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
