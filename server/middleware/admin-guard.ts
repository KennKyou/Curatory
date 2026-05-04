const ADMIN_ROUTES = [
  '/platform',
  '/api/s3/scan',
  '/api/user/photo-count',
  '/api/platform',
]

function isAdminRoute(path: string): boolean {
  if (path === '/platform/login' || path === '/platform/register') return false
  return ADMIN_ROUTES.some(route => path === route || path.startsWith(route + '/'))
}

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!isAdminRoute(path)) return

  const session = await getUserSession(event)

  const isApi = path.startsWith('/api/')

  if (!session?.user) {
    if (isApi) {
      throw createError({ statusCode: 401, message: 'Authentication required' })
    }
    return sendRedirect(event, '/platform/login')
  }
})
