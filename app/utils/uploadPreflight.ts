export interface UploadPreflightResult {
  toAdd: File[]
  oversized: File[]
  droppedByCount: number
}

/**
 * Partition an incoming File[] into the subset that should be added to the
 * upload list, the subset rejected for exceeding the per-file size limit, and
 * the number of files dropped because the combined list would exceed the count
 * limit. Oversized files do not count toward droppedByCount.
 */
export function partitionUploadFiles(
  incoming: File[],
  existingCount: number,
  maxFileSize: number,
  maxFileCount: number,
): UploadPreflightResult {
  const oversized: File[] = []
  const valid: File[] = []

  for (const file of incoming) {
    if (file.size > maxFileSize) {
      oversized.push(file)
    } else {
      valid.push(file)
    }
  }

  const remainingSlots = Math.max(0, maxFileCount - existingCount)
  const toAdd = valid.slice(0, remainingSlots)
  const droppedByCount = valid.length - toAdd.length

  return { toAdd, oversized, droppedByCount }
}

/**
 * Classify an upload error. ofetch errors can expose status via `statusCode`
 * (h3 style) or `response.status` (fetch style); we check both.
 */
export function classifyUploadError(err: unknown): 'too-large' | 'other' {
  if (!err || typeof err !== 'object') return 'other'
  const candidate = err as { statusCode?: unknown; response?: { status?: unknown } }
  const status = typeof candidate.statusCode === 'number'
    ? candidate.statusCode
    : typeof candidate.response?.status === 'number'
      ? candidate.response.status
      : undefined
  return status === 413 ? 'too-large' : 'other'
}
