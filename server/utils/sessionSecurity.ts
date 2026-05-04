export type SessionCookieSameSite = 'lax' | 'strict'

export interface SessionRuntimeConfig {
  cookie: {
    httpOnly: true
    secure: boolean
    sameSite: SessionCookieSameSite
  }
}

export function getSessionRuntimeConfig(nodeEnv = process.env.NODE_ENV): SessionRuntimeConfig {
  return {
    cookie: {
      httpOnly: true,
      secure: nodeEnv === 'production',
      sameSite: 'lax',
    },
  }
}
