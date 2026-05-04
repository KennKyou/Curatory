import mongoose, { Schema, type Document } from 'mongoose'
import { REACTION_EMOJI_KEYS, type ReactionEmojiKey } from '~~/server/utils/reactions/emojiSet'

export interface IReaction extends Document {
  photoId: mongoose.Types.ObjectId
  emoji: ReactionEmojiKey
  fingerprintId: string
  createdAt: Date
}

const ReactionSchema = new Schema<IReaction>(
  {
    photoId: { type: Schema.Types.ObjectId, ref: 'Photo', required: true },
    emoji: {
      type: String,
      required: true,
      enum: REACTION_EMOJI_KEYS as unknown as string[],
    },
    fingerprintId: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

ReactionSchema.index(
  { photoId: 1, emoji: 1, fingerprintId: 1 },
  { unique: true, name: 'reaction_unique_photo_emoji_fingerprint' },
)

ReactionSchema.index({ fingerprintId: 1 })

export const Reaction =
  mongoose.models.Reaction || mongoose.model<IReaction>('Reaction', ReactionSchema)
