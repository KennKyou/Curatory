import { S3Client } from '@aws-sdk/client-s3'

export function getS3Client(): S3Client {
  const config = useRuntimeConfig()
  const options: ConstructorParameters<typeof S3Client>[0] = {
    region: config.s3Region,
    credentials: {
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey,
    },
  }

  if (config.s3Endpoint) {
    options.endpoint = config.s3Endpoint
    options.forcePathStyle = true
  }

  return new S3Client(options)
}

export function getS3Bucket(): string {
  const config = useRuntimeConfig()
  return config.s3Bucket
}

export function getPublicUrl(key: string): string {
  const config = useRuntimeConfig()
  if (config.s3PublicUrl) {
    return `${config.s3PublicUrl}/${encodeURIComponent(key)}`
  }
  return `https://${config.s3Bucket}.s3.${config.s3Region}.amazonaws.com/${encodeURIComponent(key)}`
}
