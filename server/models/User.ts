import mongoose, { Schema, type Document } from 'mongoose'

export interface IUser extends Document {
  email: string
  passwordHash: string
  name: string
  avatar: string
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    avatar: { type: String, default: '' },
  },
  { timestamps: true },
)

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema)
