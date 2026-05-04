import { describe, it, expect } from 'vitest'
import mongoose from 'mongoose'
import { createMockEvent } from '~/tests/h3-helpers'
import { createTestPhoto } from '~/tests/helpers'
import { SiteSettings } from '~/server/models/SiteSettings'
import handler from '~/server/api/platform/settings.put'

describe('PUT /api/platform/settings', () => {
  const userId = new mongoose.Types.ObjectId()
  const session = { user: { id: userId.toString(), email: 'admin@test.com' } }

  it('creates settings via upsert and returns Curatory fields', async () => {
    const result = await handler(createMockEvent({
      session,
      body: { siteName: 'My Site', authorName: 'Author' },
    }) as any)

    expect(result.siteName).toBe('My Site')
    expect(result.authorName).toBe('Author')
    expect(result.homePageTitle).toBe('')
    expect(result.storageQuota).toBe(0)
    expect(result.showGpsInfo).toBe(false)
    expect(result.showRssLink).toBe(false)
    expect(result.exhibition.sections).toEqual([])
    expect(result.socialLinks.website).toBe('')
    expect(result).not.toHaveProperty('publicLayout')
    expect(result).not.toHaveProperty('portfolioHeroPhotoId')
  })

  it('updates existing settings', async () => {
    await SiteSettings.create({ userId, siteName: 'Old Name' })

    const result = await handler(createMockEvent({
      session,
      body: { siteName: 'New Name' },
    }) as any)

    expect(result.siteName).toBe('New Name')
  })

  it('validates URLs and social email values', async () => {
    await expect(handler(createMockEvent({
      session,
      body: { siteUrl: 'not-a-url' },
    }) as any)).rejects.toThrow('Invalid URL: siteUrl')

    await expect(handler(createMockEvent({
      session,
      body: { socialLinks: { github: 'not-a-url' } },
    }) as any)).rejects.toThrow('Invalid URL: socialLinks.github')

    await expect(handler(createMockEvent({
      session,
      body: { socialLinks: { email: 'invalid-email' } },
    }) as any)).rejects.toThrow('Invalid email: socialLinks.email')
  })

  it('ignores fields outside the allowlist', async () => {
    const result = await handler(createMockEvent({
      session,
      body: { siteName: 'Test', hackerField: 'malicious', publicLayout: 'portfolio' },
    }) as any)

    expect(result.siteName).toBe('Test')
    const raw = await SiteSettings.findOne({ userId }).lean()
    expect((raw as any)?.hackerField).toBeUndefined()
    expect((raw as any)?.publicLayout).toBeUndefined()
  })

  it('persists exhibition cover metadata and ordered sections', async () => {
    const cover = await createTestPhoto({ userId, key: 'cover.jpg' })
    const image = await createTestPhoto({ userId, key: 'image.jpg' })

    const result = await handler(createMockEvent({
      session,
      body: {
        exhibition: {
          coverPhotoId: cover._id.toString(),
          title: 'Island Light',
          subtitle: 'A spring exhibition',
          description: 'A short exhibition note.',
          startDate: '2026-05-01',
          endDate: '2026-05-31',
          theme: 'black',
          coverTextColor: 'black',
          coverProtection: 'strong',
          sections: [
            {
              id: 'section-a',
              layout: 'media',
              theme: 'black',
              title: 'Arrival',
              body: 'The first room.',
              photoIds: [image._id.toString(), cover._id.toString()],
              textPosition: 'left',
              desktopTextAlign: 'right',
              mobileTextAlign: 'center',
              reserveTextSpace: true,
            },
          ],
        },
      },
    }) as any)

    expect(result.exhibition.coverPhotoId).toBe(cover._id.toString())
    expect(result.exhibition.title).toBe('Island Light')
    expect(result.exhibition.theme).toBe('black')
    expect(result.exhibition.coverTextColor).toBe('black')
    expect(result.exhibition.coverProtection).toBe('strong')
    expect(result.exhibition.sections).toEqual([
      {
        id: 'section-a',
        layout: 'media',
        theme: 'black',
        title: 'Arrival',
        body: 'The first room.',
        photoIds: [image._id.toString(), cover._id.toString()],
        textPosition: 'left',
        desktopTextAlign: 'right',
        mobileTextAlign: 'center',
        reserveTextSpace: true,
      },
    ])

    const raw = await SiteSettings.findOne({ userId }).lean()
    expect(raw?.exhibition?.coverPhotoId?.toString()).toBe(cover._id.toString())
    expect(raw?.exhibition?.sections?.[0]?.photoIds.map(id => id.toString())).toEqual([image._id.toString(), cover._id.toString()])
  })

  it('persists media bottom text as caption-like content', async () => {
    const image = await createTestPhoto({ userId, key: 'single.jpg' })

    const result = await handler(createMockEvent({
      session,
      body: {
        exhibition: {
          sections: [
            {
              id: 'single-section',
              layout: 'media',
              body: 'Archival inkjet print, 2026.',
              photoIds: [image._id.toString()],
              textPosition: 'bottom',
            },
          ],
        },
      },
    }) as any)

    expect(result.exhibition.sections[0]).toMatchObject({
      id: 'single-section',
      layout: 'media',
      body: 'Archival inkjet print, 2026.',
      photoIds: [image._id.toString()],
      textPosition: 'bottom',
      desktopTextAlign: 'left',
      mobileTextAlign: 'left',
      reserveTextSpace: false,
    })
  })

  it('normalizes missing exhibition section text alignment values by layout', async () => {
    const image = await createTestPhoto({ userId, key: 'aligned.jpg' })

    const result = await handler(createMockEvent({
      session,
      body: {
        exhibition: {
          sections: [
            {
              id: 'media-section',
              layout: 'media',
              photoIds: [image._id.toString()],
              textPosition: 'right',
            },
            {
              id: 'text-section',
              layout: 'text',
              title: 'Essay',
              body: 'Only copy.',
              photoIds: [],
              textPosition: 'none',
            },
          ],
        },
      },
    }) as any)

    expect(result.exhibition.sections[0]).toMatchObject({
      id: 'media-section',
      desktopTextAlign: 'left',
      mobileTextAlign: 'left',
    })
    expect(result.exhibition.sections[1]).toMatchObject({
      id: 'text-section',
      desktopTextAlign: 'center',
      mobileTextAlign: 'center',
    })
  })

  it('rejects invalid exhibition section text alignment values without changing existing settings', async () => {
    const image = await createTestPhoto({ userId, key: 'invalid-align.jpg' })
    await SiteSettings.create({
      userId,
      siteName: 'Existing',
      exhibition: { title: 'Existing Exhibition' },
    })

    await expect(handler(createMockEvent({
      session,
      body: {
        siteName: 'Changed',
        exhibition: {
          sections: [
            {
              id: 'section-a',
              layout: 'media',
              photoIds: [image._id.toString()],
              textPosition: 'right',
              desktopTextAlign: 'justify',
              mobileTextAlign: 'left',
            },
          ],
        },
      },
    }) as any)).rejects.toThrow('Invalid exhibition')

    const raw = await SiteSettings.findOne({ userId }).lean()
    expect(raw?.siteName).toBe('Existing')
    expect(raw?.exhibition?.title).toBe('Existing Exhibition')
  })

  it('rejects invalid exhibition values without changing existing settings', async () => {
    await SiteSettings.create({
      userId,
      siteName: 'Existing',
      exhibition: { title: 'Existing Exhibition' },
    })

    await expect(handler(createMockEvent({
      session,
      body: {
        siteName: 'Changed',
        exhibition: {
          theme: 'blue',
          sections: [{ id: 'section-a', layout: 'freeform', title: '', body: '', photoIds: [] }],
        },
      },
    }) as any)).rejects.toThrow('Invalid exhibition')

    const raw = await SiteSettings.findOne({ userId }).lean()
    expect(raw?.siteName).toBe('Existing')
    expect(raw?.exhibition?.title).toBe('Existing Exhibition')
  })

  it('rejects exhibition photo IDs owned by another user without changing existing settings', async () => {
    await SiteSettings.create({ userId, siteName: 'Existing' })
    const otherPhoto = await createTestPhoto({ userId: new mongoose.Types.ObjectId() })

    await expect(handler(createMockEvent({
      session,
      body: {
        siteName: 'Changed',
        exhibition: {
          coverPhotoId: otherPhoto._id.toString(),
          sections: [],
        },
      },
    }) as any)).rejects.toThrow('Invalid exhibition.coverPhotoId')

    const raw = await SiteSettings.findOne({ userId }).lean()
    expect(raw?.siteName).toBe('Existing')
  })
})
