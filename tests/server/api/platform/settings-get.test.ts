import { describe, it, expect } from 'vitest'
import mongoose from 'mongoose'
import { createMockEvent } from '~/tests/h3-helpers'
import { createTestPhoto, createTestSiteSettings } from '~/tests/helpers'
import handler from '~/server/api/platform/settings.get'

const userId = new mongoose.Types.ObjectId()
const session = { user: { id: userId.toString(), email: 'test@example.com' } }

describe('platform/settings.get', () => {
  it('returns Curatory settings when they exist', async () => {
    const cover = await createTestPhoto({ userId })
    const sectionPhoto = await createTestPhoto({ userId })
    await createTestSiteSettings({
      userId,
      siteName: 'My Site',
      homePageTitle: 'Welcome',
      siteDescription: 'A photo exhibition',
      siteUrl: 'https://example.com',
      authorName: 'Tester',
      storageQuota: 5000000,
      exhibition: {
        coverPhotoId: cover._id,
        title: 'Exhibition Title',
        subtitle: 'Subtitle',
        description: 'Description',
        startDate: '2026-05-01',
        endDate: '2026-05-31',
        theme: 'black',
        coverTextColor: 'black',
        coverProtection: 'medium',
        sections: [
          {
            id: 'section-a',
            layout: 'media',
            theme: 'white',
            title: 'Section',
            body: 'Body',
            photoIds: [sectionPhoto._id],
            textPosition: 'right',
          },
        ],
      },
      socialLinks: { github: 'https://github.com/test' },
    })

    const result = await handler(createMockEvent({ session }))

    expect(result.siteName).toBe('My Site')
    expect(result.homePageTitle).toBe('Welcome')
    expect(result.siteDescription).toBe('A photo exhibition')
    expect(result.siteUrl).toBe('https://example.com')
    expect(result.authorName).toBe('Tester')
    expect(result.storageQuota).toBe(5000000)
    expect(result.showGpsInfo).toBe(false)
    expect(result.showRssLink).toBe(false)
    expect(result.exhibition.coverPhotoId).toBe(cover._id.toString())
    expect(result.exhibition.title).toBe('Exhibition Title')
    expect(result.exhibition.theme).toBe('black')
    expect(result.exhibition.coverTextColor).toBe('black')
    expect(result.exhibition.sections).toEqual([
      {
        id: 'section-a',
        layout: 'media',
        theme: 'white',
        title: 'Section',
        body: 'Body',
        photoIds: [sectionPhoto._id.toString()],
        textPosition: 'right',
        desktopTextAlign: 'left',
        mobileTextAlign: 'left',
        reserveTextSpace: false,
      },
    ])
    expect(result.socialLinks.github).toBe('https://github.com/test')
    expect(result).not.toHaveProperty('publicLayout')
  })

  it('returns defaults when no settings exist', async () => {
    const result = await handler(createMockEvent({ session }))

    expect(result.siteName).toBe('')
    expect(result.homePageTitle).toBe('')
    expect(result.storageQuota).toBe(0)
    expect(result.showGpsInfo).toBe(false)
    expect(result.showRssLink).toBe(false)
    expect(result.exhibition).toEqual({
      coverPhotoId: null,
      title: '',
      subtitle: '',
      description: '',
      startDate: null,
      endDate: null,
      theme: 'white',
      coverTextColor: 'white',
      coverProtection: 'auto',
      sections: [],
    })
    expect(result.socialLinks.github).toBe('')
    expect(result.socialLinks.instagram).toBe('')
  })
})
