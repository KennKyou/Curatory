import { describe, it, expect } from 'vitest'
import mongoose from 'mongoose'
import { createTestSiteSettings } from '~/tests/helpers'
import { SiteSettings } from '~/server/models/SiteSettings'

describe('SiteSettings model', () => {
  it('creates settings with default values', async () => {
    const settings = await createTestSiteSettings()
    expect(settings._id).toBeDefined()
    expect(settings.siteName).toBe('')
    expect(settings.homePageTitle).toBe('')
    expect(settings.siteDescription).toBe('')
    expect(settings.siteUrl).toBe('')
    expect(settings.authorName).toBe('')
    expect(settings.storageQuota).toBe(0)
    expect(settings.showGpsInfo).toBe(false)
    expect(settings.exhibition.title).toBe('')
    expect(settings.exhibition.sections).toEqual([])
  })

  it('creates settings with overrides', async () => {
    const settings = await createTestSiteSettings({
      siteName: 'My Site',
      storageQuota: 5000,
      showGpsInfo: false,
    })
    expect(settings.siteName).toBe('My Site')
    expect(settings.storageQuota).toBe(5000)
    expect(settings.showGpsInfo).toBe(false)
  })

  it('stores social links', async () => {
    const settings = await createTestSiteSettings({
      socialLinks: {
        github: 'https://github.com/test',
        instagram: 'https://instagram.com/test',
      },
    })
    expect(settings.socialLinks.github).toBe('https://github.com/test')
    expect(settings.socialLinks.instagram).toBe('https://instagram.com/test')
  })

  it('stores exhibition media sections', async () => {
    const photoA = new mongoose.Types.ObjectId()
    const photoB = new mongoose.Types.ObjectId()
    const photoC = new mongoose.Types.ObjectId()
    const settings = await createTestSiteSettings({
      exhibition: {
        sections: [
          {
            id: 'media-section',
            layout: 'media',
            title: 'Room',
            body: 'A small group.',
            photoIds: [photoA, photoB, photoC],
            textPosition: 'right',
            reserveTextSpace: true,
          },
        ],
      },
    })

    expect(settings.exhibition.sections[0]?.layout).toBe('media')
    expect(settings.exhibition.sections[0]?.textPosition).toBe('right')
    expect(settings.exhibition.sections[0]?.reserveTextSpace).toBe(true)
  })

  it('requires userId', async () => {
    await expect(SiteSettings.create({ siteName: 'Test' })).rejects.toThrow()
  })

  it('enforces unique userId', async () => {
    const userId = new mongoose.Types.ObjectId()
    await createTestSiteSettings({ userId })
    await expect(createTestSiteSettings({ userId })).rejects.toThrow()
  })
})
