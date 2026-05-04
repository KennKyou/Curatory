import { describe, expect, it } from 'vitest'
import { getSessionRuntimeConfig } from '~/server/utils/sessionSecurity'

describe('session security configuration', () => {
  it('uses HttpOnly, Secure, and SameSite=Lax in production', () => {
    const config = getSessionRuntimeConfig('production')

    expect(config.cookie.httpOnly).toBe(true)
    expect(config.cookie.secure).toBe(true)
    expect(config.cookie.sameSite).toBe('lax')
  })

  it('keeps HttpOnly and SameSite=Lax outside production without forcing Secure', () => {
    const config = getSessionRuntimeConfig('development')

    expect(config.cookie.httpOnly).toBe(true)
    expect(config.cookie.secure).toBe(false)
    expect(config.cookie.sameSite).toBe('lax')
  })
})
