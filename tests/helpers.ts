import mongoose from 'mongoose'
import { Photo, type IPhoto } from '~/server/models/Photo'
import { User, type IUser } from '~/server/models/User'
import { SiteSettings, type ISiteSettings } from '~/server/models/SiteSettings'

export async function clearCollections() {
  const collections = mongoose.connection.collections
  for (const key in collections) {
    await collections[key]!.deleteMany({})
  }
}

export async function createTestPhoto(overrides?: Partial<IPhoto>) {
  const defaults = {
    userId: new mongoose.Types.ObjectId(),
    key: `photos/test/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`,
    url: 'https://example.com/photo.jpg',
    thumbnailUrl: null,
    slug: `test-photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    size: 1024,
    lastModified: new Date(),
    takenAt: null,
    exif: null,
    width: null,
    height: null,
    blurDataUrl: null,
    cameraName: null,
    lensName: null,
    toneAnalysis: null,
  }

  return Photo.create({ ...defaults, ...overrides })
}

export async function createTestUser(overrides?: Partial<IUser>) {
  const defaults = {
    email: `test-${Date.now()}@example.com`,
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$test$test',
    name: 'Test User',
    avatar: '',
  }

  return User.create({ ...defaults, ...overrides })
}

export async function createTestSiteSettings(overrides?: Partial<ISiteSettings>) {
  const defaults = {
    userId: new mongoose.Types.ObjectId(),
    siteName: '',
    homePageTitle: '',
    siteDescription: '',
    siteUrl: '',
    socialLinks: {},
    authorName: '',
    storageQuota: 0,
    showGpsInfo: false,
    showRssLink: false,
  }

  return SiteSettings.create({ ...defaults, ...overrides })
}
