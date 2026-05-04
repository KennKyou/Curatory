import { describe, it, expect } from 'vitest'
import { createMockEvent } from '~/tests/h3-helpers'
import { createTestPhoto, createTestUser, createTestSiteSettings } from '~/tests/helpers'
import handler from '~/server/api/site-settings.get'

describe('site-settings.get', () => {
  it('returns public settings with exhibition metadata and cover preview', async () => {
    const admin = await createTestUser({ email: 'admin@test.com', avatar: 'https://example.com/avatar.jpg' })
    const cover = await createTestPhoto({ userId: admin._id })
    const sectionPhoto = await createTestPhoto({ userId: admin._id })
    await createTestSiteSettings({
      userId: admin._id,
      siteName: 'Public Site',
      authorName: 'Admin User',
      exhibition: {
        coverPhotoId: cover._id,
        title: 'Public Exhibition',
        subtitle: 'Open now',
        description: 'Exhibition description',
        startDate: '2026-05-01',
        endDate: '2026-05-31',
        theme: 'black',
        coverTextColor: 'black',
        coverProtection: 'medium',
        sections: [
          {
            id: 'section-a',
            layout: 'media',
            theme: 'black',
            title: 'Section',
            body: 'Body',
            photoIds: [sectionPhoto._id],
            textPosition: 'right',
            reserveTextSpace: false,
          },
        ],
      },
    })

    const result = await handler(createMockEvent({}))

    expect(result.siteName).toBe('Public Site')
    expect(result.authorName).toBe('Admin User')
    expect(result.avatarUrl).toBe('https://example.com/avatar.jpg')
    expect(result.exhibition.title).toBe('Public Exhibition')
    expect(result.exhibition.coverPhotoId).toBe(cover._id.toString())
    expect(result.exhibitionCoverPhoto).toEqual({
      id: cover._id.toString(),
      url: cover.url,
      thumbnailUrl: cover.thumbnailUrl,
    })
    expect(result.exhibition.sections[0]).toMatchObject({
      id: 'section-a',
      layout: 'media',
      textPosition: 'right',
      desktopTextAlign: 'left',
      mobileTextAlign: 'left',
      photoIds: [sectionPhoto._id.toString()],
    })
    expect(result).not.toHaveProperty('publicLayout')
    expect(result).not.toHaveProperty('portfolioHeroPhotoId')
    expect(result).not.toHaveProperty('portfolioFeaturedPhotoIds')
  })

  it('returns defaults when no settings exist', async () => {
    await createTestUser({ email: 'admin@test.com' })

    const result = await handler(createMockEvent({}))

    expect(result.siteName).toBe('')
    expect(result.authorName).toBe('')
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
    expect(result.exhibitionCoverPhoto).toBeNull()
    expect(result.socialLinks.github).toBe('')
  })

  it('returns empty avatarUrl when no user exists', async () => {
    const result = await handler(createMockEvent({}))

    expect(result.avatarUrl).toBe('')
  })
})
