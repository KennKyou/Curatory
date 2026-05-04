import { describe, expect, it } from 'vitest'
import { getPhotoOgBrandName } from '~/server/api/og/photos/[slug].get'

describe('photo OG image branding', () => {
  it('uses the exhibition title when available', () => {
    expect(getPhotoOgBrandName({
      siteName: 'Photo Site',
      exhibition: { title: 'Island Light' },
    })).toBe('Island Light')
  })

  it('falls back to site name when exhibition title is empty', () => {
    expect(getPhotoOgBrandName({
      siteName: 'Photo Site',
      exhibition: { title: '  ' },
    })).toBe('Photo Site')
  })

  it('falls back to Curatory when no title or site name exists', () => {
    expect(getPhotoOgBrandName({
      siteName: '',
      exhibition: { title: '' },
    })).toBe('Curatory')
  })
})
