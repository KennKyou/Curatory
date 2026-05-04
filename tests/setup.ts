import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { beforeAll, afterAll, afterEach, vi } from 'vitest'
import { clearCollections } from './helpers'

// Mock Nuxt auto-imports — H3 global stubs
vi.stubGlobal('createError', (opts: { statusCode: number, message: string }) => {
  const err = new Error(opts.message) as Error & { statusCode: number }
  err.statusCode = opts.statusCode
  return err
})

vi.stubGlobal('defineEventHandler', (fn: Function) => fn)

vi.stubGlobal('getQuery', (event: any) => event.__query || {})

vi.stubGlobal('readBody', (event: any) => Promise.resolve(event.__body || {}))

vi.stubGlobal('getRouterParam', (event: any, name: string) => event.__params?.[name])

vi.stubGlobal('requireUserSession', (event: any) => {
  if (!event.__session) {
    throw createError({ statusCode: 401, message: 'Authentication required' })
  }
  return Promise.resolve(event.__session)
})

vi.stubGlobal('getUserSession', (event: any) => {
  return Promise.resolve(event.__session || null)
})

vi.stubGlobal('useRuntimeConfig', () => ({
  adminEmail: 'admin@test.com',
}))

vi.stubGlobal('getRequestURL', (event: any) => {
  return new URL(event.__path || '/', 'http://localhost')
})

vi.stubGlobal('getRequestHeader', (event: any, name: string) => {
  return event.__headers?.[name]
})

vi.stubGlobal('getRequestIP', () => '127.0.0.1')

vi.stubGlobal('setResponseHeader', (event: any, name: string, value: string) => {
  if (!event.__responseHeaders) event.__responseHeaders = {}
  event.__responseHeaders[name] = value
})

vi.stubGlobal('sendRedirect', (_event: any, url: string) => {
  return { __redirect: url }
})

vi.stubGlobal('readMultipartFormData', (event: any) => {
  return Promise.resolve(event.__multipartFormData || null)
})

// Mock S3 client module (handlers import from ~~/server/utils/s3client)
vi.mock('~/server/utils/s3client', () => ({
  getS3Client: vi.fn(() => {
    throw new Error('getS3Client not mocked in this test — call vi.mocked(getS3Client).mockReturnValue(mockClient)')
  }),
  getS3Bucket: vi.fn(() => 'test-bucket'),
  getPublicUrl: vi.fn((key: string) => `https://test-cdn.example.com/${key}`),
}))
vi.mock('~~/server/utils/s3client', () => ({
  getS3Client: vi.fn(() => {
    throw new Error('getS3Client not mocked in this test — call vi.mocked(getS3Client).mockReturnValue(mockClient)')
  }),
  getS3Bucket: vi.fn(() => 'test-bucket'),
  getPublicUrl: vi.fn((key: string) => `https://test-cdn.example.com/${key}`),
}))

let mongoServer: MongoMemoryServer

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: { ip: '127.0.0.1' },
  })
  const uri = mongoServer.getUri()
  await mongoose.connect(uri)
})

afterEach(async () => {
  await clearCollections()
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})
