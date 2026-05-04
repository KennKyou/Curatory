import { validateCsrfRequest } from '../utils/csrf'

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  const result = validateCsrfRequest({
    method: event.method,
    path,
    origin: getRequestHeader(event, 'origin'),
    referer: getRequestHeader(event, 'referer'),
    host: getRequestHeader(event, 'host'),
    forwardedHost: getRequestHeader(event, 'x-forwarded-host'),
    forwardedProto: getRequestHeader(event, 'x-forwarded-proto'),
    nodeEnv: process.env.NODE_ENV,
  })

  if (!result.valid) {
    throw createError({ statusCode: 403, message: 'Invalid request origin' })
  }
})
