import { describe, it, expect } from 'vitest'
import { stripGpsFromExif } from '~/server/utils/exifPrivacy'

describe('stripGpsFromExif', () => {
  it('returns null when input is null', () => {
    expect(stripGpsFromExif(null)).toBeNull()
  })

  it('returns undefined when input is undefined', () => {
    expect(stripGpsFromExif(undefined)).toBeUndefined()
  })

  it('returns an equivalent object when exif has no GPSInfo', () => {
    const exif = {
      Image: { Make: 'Canon', Model: 'EOS R5' },
      Photo: { ExposureTime: 0.01, FNumber: 2.8 },
    }
    const result = stripGpsFromExif(exif)
    expect(result).toEqual(exif)
  })

  it('removes GPSInfo while preserving all other keys', () => {
    const exif = {
      Image: { Make: 'Canon', Model: 'EOS R5' },
      Photo: { ExposureTime: 0.01 },
      GPSInfo: {
        GPSLatitude: [25, 2, 30],
        GPSLongitude: [121, 33, 15],
        GPSLatitudeRef: 'N',
        GPSLongitudeRef: 'E',
      },
    }
    const result = stripGpsFromExif(exif)
    expect(result).not.toBeNull()
    expect(result!.GPSInfo).toBeUndefined()
    expect('GPSInfo' in (result as object)).toBe(false)
    expect(result!.Image).toEqual({ Make: 'Canon', Model: 'EOS R5' })
    expect(result!.Photo).toEqual({ ExposureTime: 0.01 })
  })

  it('does not mutate the input object', () => {
    const exif = {
      Image: { Make: 'Canon' },
      GPSInfo: { GPSLatitude: [25, 2, 30] },
    }
    stripGpsFromExif(exif)
    expect(exif.GPSInfo).toBeDefined()
    expect(exif.GPSInfo.GPSLatitude).toEqual([25, 2, 30])
  })

  it('returns a new object reference (shallow clone)', () => {
    const exif = { Image: { Make: 'Canon' }, GPSInfo: { GPSLatitude: [1] } }
    const result = stripGpsFromExif(exif)
    expect(result).not.toBe(exif)
  })

  it('handles exif with only GPSInfo key', () => {
    const exif = { GPSInfo: { GPSLatitude: [25, 2, 30] } }
    const result = stripGpsFromExif(exif)
    expect(result).toEqual({})
  })
})
