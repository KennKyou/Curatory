interface TurnstileVerifyResponse {
  success: boolean
  'error-codes'?: string[]
}

export async function verifyTurnstileToken(event: any, token: unknown) {
  const config = useRuntimeConfig()
  const secret = String(config.turnstileSecretKey || '')

  if (!secret) return
  if (typeof token !== 'string' || !token.trim()) {
    throw createError({ statusCode: 400, message: 'Turnstile verification required' })
  }

  const form = new FormData()
  form.append('secret', secret)
  form.append('response', token)
  const ip = getRequestIP(event)
  if (ip) form.append('remoteip', ip)

  const result = await $fetch<TurnstileVerifyResponse>('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  })

  if (!result.success) {
    throw createError({ statusCode: 400, message: 'Turnstile verification failed' })
  }
}
