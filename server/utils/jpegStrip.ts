/**
 * Lossless JPEG EXIF stripper.
 *
 * Walks a JPEG byte stream marker by marker and removes every APP1 segment
 * whose payload begins with the ASCII identifier `Exif\0\0`. All other bytes
 * — APP0/JFIF, APP1/XMP, APP2/ICC, DQT, DHT, SOS header, compressed entropy
 * data, EOI — are copied verbatim, so the compressed DCT data is not
 * re-quantized and image fidelity is fully preserved.
 *
 * Returns null on any structural anomaly (missing SOI, invalid marker,
 * segment length < 2, truncated segment). Callers SHOULD fall back to a
 * re-encode path on null.
 */

const EXIF_SIGNATURE = Buffer.from('Exif\0\0', 'ascii')

export function stripExifLossless(input: Buffer): Buffer | null {
  if (input.length < 4) return null
  // SOI marker
  if (input.readUInt8(0) !== 0xff || input.readUInt8(1) !== 0xd8) return null

  const chunks: Buffer[] = [input.subarray(0, 2)]
  let pos = 2

  while (pos < input.length) {
    // Every marker must begin with 0xFF. Consecutive 0xFF bytes are allowed
    // as padding ("fill bytes") — skip them.
    if (input.readUInt8(pos) !== 0xff) return null
    while (pos < input.length && input.readUInt8(pos) === 0xff) {
      pos++
    }
    if (pos >= input.length) return null

    const marker = input.readUInt8(pos)
    pos++ // now pointing at byte after marker code

    // Standalone markers (no length field, no payload):
    //   SOI (0xD8), EOI (0xD9), RSTn (0xD0-0xD7), TEM (0x01)
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      chunks.push(Buffer.from([0xff, marker]))
      if (marker === 0xd9) {
        // EOI — everything after should already have been handled by SOS branch,
        // but if we reach EOI directly just finish.
        return Buffer.concat(chunks)
      }
      continue
    }

    // Length-bearing segment. Length field is 2 bytes big-endian and includes
    // those 2 bytes themselves.
    if (pos + 2 > input.length) return null
    const segLen = input.readUInt16BE(pos)
    if (segLen < 2) return null
    const segStart = pos - 2 // start of 0xFF <marker>
    const segEnd = pos + segLen // exclusive: end of payload
    if (segEnd > input.length) return null

    // SOS (Start of Scan): after the SOS segment header comes entropy-coded
    // image data, which may contain arbitrary 0xFF bytes (escaped as 0xFF 0x00).
    // We MUST NOT try to parse markers inside entropy data. Copy the SOS
    // segment header plus everything remaining in the input verbatim and stop.
    if (marker === 0xda) {
      chunks.push(input.subarray(segStart, input.length))
      return Buffer.concat(chunks)
    }

    // APP1 (0xE1): check for EXIF signature at the start of the payload.
    // Payload begins at pos + 2 (after the length field).
    if (marker === 0xe1) {
      const payloadStart = pos + 2
      const payloadLen = segLen - 2
      if (
        payloadLen >= EXIF_SIGNATURE.length
        && input.subarray(payloadStart, payloadStart + EXIF_SIGNATURE.length).equals(EXIF_SIGNATURE)
      ) {
        // Skip this segment entirely (do not push to chunks)
        pos = segEnd
        continue
      }
    }

    // Keep this segment: push its full bytes (marker + length + payload)
    chunks.push(input.subarray(segStart, segEnd))
    pos = segEnd
  }

  // Reached end of input without SOS or EOI — malformed
  return null
}
