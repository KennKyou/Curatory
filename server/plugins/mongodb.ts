import mongoose from 'mongoose'

export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig()

  if (!config.mongodbUri) {
    console.warn('[MongoDB] NUXT_MONGODB_URI is not set, skipping connection')
    return
  }

  try {
    const dbName = config.mongodbDatabase || 'curatory'
    await mongoose.connect(config.mongodbUri, {
      dbName,
    } as mongoose.ConnectOptions)
    console.log(`[MongoDB] Connected to database: ${dbName}`)
  } catch (err) {
    console.error('[MongoDB] Connection failed:', err)
  }
})
