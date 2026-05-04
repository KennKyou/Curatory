import { describe, it, expect } from 'vitest'
import { partitionUploadFiles, classifyUploadError } from '~/app/utils/uploadPreflight'

function fakeFile(name: string, size: number): File {
  // partitionUploadFiles only reads `name` and `size`, so a structural stub is enough.
  return { name, size, type: 'image/jpeg' } as unknown as File
}

const MAX_SIZE = 20 * 1024 * 1024
const MAX_COUNT = 20

describe('partitionUploadFiles', () => {
  it('accepts all files when within limits', () => {
    const incoming = [fakeFile('a.jpg', 1_000_000), fakeFile('b.jpg', 5_000_000)]
    const result = partitionUploadFiles(incoming, 0, MAX_SIZE, MAX_COUNT)
    expect(result.toAdd).toHaveLength(2)
    expect(result.oversized).toEqual([])
    expect(result.droppedByCount).toBe(0)
  })

  it('rejects a single oversized file and keeps valid ones', () => {
    const big = fakeFile('big.jpg', MAX_SIZE + 1)
    const small = fakeFile('small.jpg', 1_000_000)
    const result = partitionUploadFiles([big, small], 0, MAX_SIZE, MAX_COUNT)
    expect(result.toAdd).toEqual([small])
    expect(result.oversized).toEqual([big])
    expect(result.droppedByCount).toBe(0)
  })

  it('allows files exactly at the size limit', () => {
    const exact = fakeFile('exact.jpg', MAX_SIZE)
    const result = partitionUploadFiles([exact], 0, MAX_SIZE, MAX_COUNT)
    expect(result.toAdd).toEqual([exact])
    expect(result.oversized).toEqual([])
  })

  it('truncates when combined count exceeds the max count', () => {
    const incoming = Array.from({ length: 25 }, (_, i) => fakeFile(`p${i}.jpg`, 1000))
    const result = partitionUploadFiles(incoming, 0, MAX_SIZE, MAX_COUNT)
    expect(result.toAdd).toHaveLength(MAX_COUNT)
    expect(result.droppedByCount).toBe(5)
  })

  it('respects existing count when truncating', () => {
    const incoming = Array.from({ length: 15 }, (_, i) => fakeFile(`p${i}.jpg`, 1000))
    const result = partitionUploadFiles(incoming, 10, MAX_SIZE, MAX_COUNT)
    expect(result.toAdd).toHaveLength(10) // only 10 slots remain
    expect(result.droppedByCount).toBe(5)
  })

  it('returns zero dropped count when existing count already at max', () => {
    const incoming = [fakeFile('p.jpg', 1000)]
    const result = partitionUploadFiles(incoming, MAX_COUNT, MAX_SIZE, MAX_COUNT)
    expect(result.toAdd).toHaveLength(0)
    expect(result.droppedByCount).toBe(1)
  })

  it('counts oversized files toward oversized, not droppedByCount', () => {
    const big = fakeFile('big.jpg', MAX_SIZE + 1)
    const smalls = Array.from({ length: 21 }, (_, i) => fakeFile(`p${i}.jpg`, 1000))
    const result = partitionUploadFiles([big, ...smalls], 0, MAX_SIZE, MAX_COUNT)
    expect(result.oversized).toEqual([big])
    expect(result.toAdd).toHaveLength(MAX_COUNT)
    expect(result.droppedByCount).toBe(1) // 21 valid minus 20 accepted
  })
})

describe('classifyUploadError', () => {
  it('detects 413 from h3-style statusCode field', () => {
    expect(classifyUploadError({ statusCode: 413 })).toBe('too-large')
  })

  it('detects 413 from ofetch-style response.status field', () => {
    expect(classifyUploadError({ response: { status: 413 } })).toBe('too-large')
  })

  it('returns other for 500', () => {
    expect(classifyUploadError({ statusCode: 500 })).toBe('other')
  })

  it('returns other for network errors with no status', () => {
    expect(classifyUploadError(new Error('network down'))).toBe('other')
  })

  it('returns other for null/undefined', () => {
    expect(classifyUploadError(null)).toBe('other')
    expect(classifyUploadError(undefined)).toBe('other')
  })

  it('prefers statusCode over response.status when both present', () => {
    expect(classifyUploadError({ statusCode: 413, response: { status: 500 } })).toBe('too-large')
  })
})
