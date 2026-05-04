import { describe, it, expect } from 'vitest'
import { formatBytes } from '~/app/utils/formatBytes'

describe('formatBytes', () => {
  it('returns "0 B" for 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B')
  })

  it('formats kilobytes with 1 decimal', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats megabytes with 1 decimal', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB')
    expect(formatBytes(2.5 * 1024 ** 2)).toBe('2.5 MB')
  })

  it('formats gigabytes with 1 decimal', () => {
    expect(formatBytes(1024 ** 3)).toBe('1.0 GB')
  })

  it('formats terabytes with 1 decimal', () => {
    expect(formatBytes(1024 ** 4)).toBe('1.0 TB')
  })
})
