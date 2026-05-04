import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { stripExifLossless } from '~/server/utils/jpegStrip'

// ---------- Synthetic JPEG builder helpers ----------
// Build a fake-but-structurally-valid JPEG for parser unit tests.
// The parser only needs to walk markers until SOS; after SOS it copies verbatim.

const SOI = Buffer.from([0xff, 0xd8])
const EOI = Buffer.from([0xff, 0xd9])
const SOS_HEADER = Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00]) // minimal SOS header

function segment(markerHi: number, markerLo: number, payload: Buffer): Buffer {
  const len = payload.length + 2
  const header = Buffer.from([markerHi, markerLo, (len >> 8) & 0xff, len & 0xff])
  return Buffer.concat([header, payload])
}

function app0Jfif(): Buffer {
  // 'JFIF\0' + version 1.01 + aspect ratio unit + x/y density + thumbnail 0x0
  const payload = Buffer.concat([
    Buffer.from('JFIF\0', 'ascii'),
    Buffer.from([0x01, 0x01, 0x00, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00]),
  ])
  return segment(0xff, 0xe0, payload)
}

function app1Exif(extraBytes = 50): Buffer {
  const payload = Buffer.concat([
    Buffer.from('Exif\0\0', 'ascii'),
    Buffer.alloc(extraBytes, 0xab),
  ])
  return segment(0xff, 0xe1, payload)
}

function app1Xmp(extraBytes = 30): Buffer {
  const payload = Buffer.concat([
    Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'ascii'),
    Buffer.alloc(extraBytes, 0xcd),
  ])
  return segment(0xff, 0xe1, payload)
}

function app2Icc(extraBytes = 40): Buffer {
  const payload = Buffer.concat([
    Buffer.from('ICC_PROFILE\0', 'ascii'),
    Buffer.from([0x01, 0x01]), // chunk 1 of 1
    Buffer.alloc(extraBytes, 0xef),
  ])
  return segment(0xff, 0xe2, payload)
}

function dqtDummy(): Buffer {
  return segment(0xff, 0xdb, Buffer.alloc(64, 0x10))
}

// Compressed entropy data that deliberately contains 0xFF 0xE1 bytes
// (which in a real JPEG would be escaped as 0xFF 0x00, but we're testing
// that the parser does NOT scan past SOS looking for markers).
function entropyDataWithFalseMarker(): Buffer {
  return Buffer.from([
    0x12, 0x34, 0xff, 0xe1, 0x00, 0x10, 0x56, 0x78, // bogus marker bytes in data
    0x9a, 0xbc, 0xde, 0xf0,
  ])
}

function buildJpeg(...preSosSegments: Buffer[]): Buffer {
  return Buffer.concat([
    SOI,
    ...preSosSegments,
    SOS_HEADER,
    entropyDataWithFalseMarker(),
    EOI,
  ])
}

// ---------- Tests ----------

describe('stripExifLossless', () => {
  it('returns byte-identical output when input has no APP1 EXIF', () => {
    const input = buildJpeg(app0Jfif(), dqtDummy())
    const output = stripExifLossless(input)
    expect(output).not.toBeNull()
    expect(output!.equals(input)).toBe(true)
  })

  it('removes a single APP1 EXIF segment and preserves everything else', () => {
    const exif = app1Exif(100)
    const input = buildJpeg(app0Jfif(), exif, dqtDummy())
    const expected = buildJpeg(app0Jfif(), dqtDummy())
    const output = stripExifLossless(input)
    expect(output).not.toBeNull()
    expect(output!.equals(expected)).toBe(true)
    // Bytes removed === full segment length (marker 2 + length field 2 + payload)
    expect(input.length - output!.length).toBe(exif.length)
  })

  it('preserves APP2 ICC profile segments', () => {
    const input = buildJpeg(app0Jfif(), app1Exif(), app2Icc(80), dqtDummy())
    const output = stripExifLossless(input)
    expect(output).not.toBeNull()
    // ICC segment payload must appear unchanged in output
    const iccMarker = Buffer.from('ICC_PROFILE\0', 'ascii')
    expect(output!.indexOf(iccMarker)).toBeGreaterThan(-1)
    // EXIF signature must be gone
    const exifSig = Buffer.from('Exif\0\0', 'ascii')
    expect(output!.indexOf(exifSig)).toBe(-1)
  })

  it('preserves APP1 XMP segments (only EXIF-signed APP1 is removed)', () => {
    const input = buildJpeg(app0Jfif(), app1Exif(), app1Xmp(60), dqtDummy())
    const output = stripExifLossless(input)
    expect(output).not.toBeNull()
    const xmpSig = Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'ascii')
    expect(output!.indexOf(xmpSig)).toBeGreaterThan(-1)
    const exifSig = Buffer.from('Exif\0\0', 'ascii')
    expect(output!.indexOf(exifSig)).toBe(-1)
  })

  it('removes multiple APP1 EXIF segments while keeping XMP', () => {
    const input = buildJpeg(app0Jfif(), app1Exif(30), app1Xmp(20), app1Exif(40), dqtDummy())
    const expected = buildJpeg(app0Jfif(), app1Xmp(20), dqtDummy())
    const output = stripExifLossless(input)
    expect(output).not.toBeNull()
    expect(output!.equals(expected)).toBe(true)
  })

  it('preserves all bytes after SOS verbatim (does not misread 0xFF 0xE1 inside entropy data)', () => {
    const input = buildJpeg(app0Jfif(), app1Exif(), dqtDummy())
    const output = stripExifLossless(input)
    expect(output).not.toBeNull()
    // The output must end with the same entropy data + EOI
    const entropy = entropyDataWithFalseMarker()
    const tail = Buffer.concat([entropy, EOI])
    expect(output!.subarray(output!.length - tail.length).equals(tail)).toBe(true)
  })

  it('returns null when input does not start with SOI', () => {
    const bogus = Buffer.concat([Buffer.from([0x00, 0x00]), buildJpeg(app0Jfif(), dqtDummy()).subarray(2)])
    expect(stripExifLossless(bogus)).toBeNull()
  })

  it('returns null when a segment length is truncated', () => {
    // Build a JPEG and truncate it in the middle of an APP1 segment
    const input = buildJpeg(app0Jfif(), app1Exif(200), dqtDummy())
    const truncated = input.subarray(0, SOI.length + app0Jfif().length + 6) // cut mid-APP1
    expect(stripExifLossless(truncated)).toBeNull()
  })

  it('returns null when a segment length is less than 2', () => {
    // Hand-craft a JPEG with a malformed segment length = 1
    const bad = Buffer.concat([
      SOI,
      Buffer.from([0xff, 0xe1, 0x00, 0x01, 0x00]), // APP1 with length 1 (invalid)
      SOS_HEADER,
      EOI,
    ])
    expect(stripExifLossless(bad)).toBeNull()
  })

  it('handles 0xFF padding bytes before a marker', () => {
    // Insert an extra 0xFF before the APP1 EXIF marker
    const exif = app1Exif(20)
    const input = Buffer.concat([
      SOI,
      app0Jfif(),
      Buffer.from([0xff]), // padding
      exif,
      dqtDummy(),
      SOS_HEADER,
      entropyDataWithFalseMarker(),
      EOI,
    ])
    const output = stripExifLossless(input)
    expect(output).not.toBeNull()
    // EXIF should be gone
    expect(output!.indexOf(Buffer.from('Exif\0\0', 'ascii'))).toBe(-1)
  })

  it('output of a sharp-generated JPEG with EXIF decodes with no EXIF', async () => {
    const buffer = await sharp({
      create: { width: 32, height: 32, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .withExif({
        IFD0: { Make: 'TestMake', Model: 'TestModel' },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '25/1 2/1 30/1' },
      })
      .jpeg()
      .toBuffer()

    const stripped = stripExifLossless(buffer)
    expect(stripped).not.toBeNull()
    // Stripped output should decode via sharp and report no EXIF
    const roundTrip = await sharp(stripped!).metadata()
    expect(roundTrip.exif).toBeUndefined()
  })

  it('output of a sharp-generated JPEG without EXIF is byte-identical', async () => {
    const buffer = await sharp({
      create: { width: 16, height: 16, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .jpeg()
      .toBuffer()

    const stripped = stripExifLossless(buffer)
    expect(stripped).not.toBeNull()
    expect(stripped!.equals(buffer)).toBe(true)
  })
})
