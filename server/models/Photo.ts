import mongoose, { Schema, type Document } from 'mongoose'
import { REACTION_EMOJI_KEYS, type ReactionEmojiKey } from '~~/server/utils/reactions/emojiSet'

export type ReactionCounts = Record<ReactionEmojiKey, number>

export const ZERO_REACTION_COUNTS: ReactionCounts = REACTION_EMOJI_KEYS.reduce(
  (acc, key) => {
    acc[key] = 0
    return acc
  },
  {} as ReactionCounts,
)

export interface IPhoto extends Document {
  userId: mongoose.Types.ObjectId
  key: string
  url: string
  thumbnailUrl: string | null
  slug: string
  size: number
  lastModified: Date
  takenAt: Date | null
  exif: Record<string, any> | null
  width: number | null
  height: number | null
  blurDataUrl: string | null
  cameraName: string | null
  lensName: string | null
  toneAnalysis: {
    toneType: string
    brightness: number
    contrast: number
    shadowRatio: number
    highlightRatio: number
    histogram: number[]
  } | null
  reactionCounts: ReactionCounts
  topReaction: ReactionEmojiKey | null
  reactionTotal: number
  createdAt: Date
}

const PhotoSchema = new Schema<IPhoto>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    key: { type: String, required: true },
    url: { type: String, required: true },
    thumbnailUrl: { type: String, default: null },
    slug: { type: String, required: true },
    size: { type: Number, required: true },
    lastModified: { type: Date, required: true },
    takenAt: { type: Date, default: null },
    exif: { type: Schema.Types.Mixed, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    blurDataUrl: { type: String, default: null },
    cameraName: { type: String, default: null },
    lensName: { type: String, default: null },
    toneAnalysis: { type: Schema.Types.Mixed, default: null },
    reactionCounts: {
      type: new Schema(
        REACTION_EMOJI_KEYS.reduce(
          (acc, key) => {
            acc[key] = { type: Number, default: 0, min: 0 }
            return acc
          },
          {} as Record<string, { type: typeof Number; default: number; min: number }>,
        ),
        { _id: false },
      ),
      default: () => ({ ...ZERO_REACTION_COUNTS }),
    },
    topReaction: {
      type: String,
      enum: [...(REACTION_EMOJI_KEYS as readonly string[]), null],
      default: null,
    },
    reactionTotal: { type: Number, default: 0, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

PhotoSchema.index({ userId: 1, key: 1 }, { unique: true })
PhotoSchema.index({ slug: 1 }, { unique: true })
PhotoSchema.index({ userId: 1, takenAt: -1 })
PhotoSchema.index({ userId: 1, createdAt: -1 })
PhotoSchema.index({ userId: 1, cameraName: 1 })
PhotoSchema.index({ userId: 1, lensName: 1 })

export const Photo = mongoose.models.Photo || mongoose.model<IPhoto>('Photo', PhotoSchema)
