const storeSymbol = Symbol('s3store')

export function createMockS3Client() {
  const store = new Map<string, Buffer>()

  const client = {
    [storeSymbol]: store,
    async send(command: any) {
      const name = command.constructor?.name || command.__name

      switch (name) {
        case 'PutObjectCommand': {
          const { Key, Body } = command.input
          const buf = Body instanceof Buffer
            ? Body
            : Buffer.from(Body ?? '')
          store.set(Key, buf)
          return {}
        }

        case 'HeadObjectCommand': {
          const { Key } = command.input
          if (!store.has(Key)) {
            const err = new Error('NotFound') as Error & { name: string; $metadata: { httpStatusCode: number } }
            err.name = 'NotFound'
            err.$metadata = { httpStatusCode: 404 }
            throw err
          }
          return { ContentLength: store.get(Key)!.length }
        }

        case 'DeleteObjectCommand': {
          const { Key } = command.input
          store.delete(Key)
          return {}
        }

        case 'CopyObjectCommand': {
          const { CopySource, Key } = command.input
          // CopySource format: "bucket/key" — strip bucket prefix
          const decoded = decodeURIComponent(CopySource)
          const slashIdx = decoded.indexOf('/')
          const sourceKey = slashIdx >= 0 ? decoded.slice(slashIdx + 1) : decoded
          const data = store.get(sourceKey)
          if (!data) {
            const err = new Error('NoSuchKey') as Error & { name: string }
            err.name = 'NoSuchKey'
            throw err
          }
          store.set(Key, Buffer.from(data))
          return {}
        }

        case 'ListObjectsV2Command': {
          const { Prefix = '', Delimiter } = command.input
          const contents: { Key: string; Size: number }[] = []
          const commonPrefixes = new Set<string>()

          for (const [key, buf] of store) {
            if (!key.startsWith(Prefix)) continue

            if (Delimiter) {
              const rest = key.slice(Prefix.length)
              const delimIdx = rest.indexOf(Delimiter)
              if (delimIdx >= 0) {
                commonPrefixes.add(Prefix + rest.slice(0, delimIdx + 1))
              } else {
                contents.push({ Key: key, Size: buf.length })
              }
            } else {
              contents.push({ Key: key, Size: buf.length })
            }
          }

          return {
            Contents: contents.length > 0 ? contents : undefined,
            CommonPrefixes: commonPrefixes.size > 0
              ? [...commonPrefixes].map(p => ({ Prefix: p }))
              : undefined,
            KeyCount: contents.length + commonPrefixes.size,
          }
        }

        default:
          throw new Error(`MockS3Client: unsupported command "${name}"`)
      }
    },
  }

  return client
}

export function getStore(client: any): Map<string, Buffer> {
  return client[storeSymbol]
}
