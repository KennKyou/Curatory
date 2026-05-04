import mongoose, { Schema, type Document } from 'mongoose'
import type { ExhibitionCoverProtection, ExhibitionCoverTextColor, ExhibitionSectionLayout, ExhibitionSectionTextAlign, ExhibitionSectionTextPosition, ExhibitionSectionTheme, ExhibitionTheme } from '~~/server/types/api'

export interface ISocialLinks {
  website?: string
  github?: string
  facebook?: string
  instagram?: string
  threads?: string
  x?: string
  email?: string
}

export interface ISiteSettings extends Document {
  userId: mongoose.Types.ObjectId
  siteName: string
  homePageTitle: string
  siteDescription: string
  siteUrl: string
  socialLinks: ISocialLinks
  authorName: string
  storageQuota: number
  showGpsInfo: boolean
  showRssLink: boolean
  exhibition: {
    coverPhotoId: mongoose.Types.ObjectId | null
    title: string
    subtitle: string
    description: string
    startDate: string | null
    endDate: string | null
    theme: ExhibitionTheme
    coverTextColor: ExhibitionCoverTextColor
    coverProtection: ExhibitionCoverProtection
    sections: Array<{
      id: string
      layout: ExhibitionSectionLayout
      theme: ExhibitionSectionTheme
      title: string
      body: string
      photoIds: mongoose.Types.ObjectId[]
      textPosition: ExhibitionSectionTextPosition
      desktopTextAlign: ExhibitionSectionTextAlign
      mobileTextAlign: ExhibitionSectionTextAlign
      reserveTextSpace: boolean
    }>
  }
  createdAt: Date
  updatedAt: Date
}

const SiteSettingsSchema = new Schema<ISiteSettings>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    siteName: { type: String, default: '' },
    homePageTitle: { type: String, default: '' },
    siteDescription: { type: String, default: '' },
    siteUrl: { type: String, default: '' },
    socialLinks: {
      website: { type: String, default: '' },
      github: { type: String, default: '' },
      facebook: { type: String, default: '' },
      instagram: { type: String, default: '' },
      threads: { type: String, default: '' },
      x: { type: String, default: '' },
      email: { type: String, default: '' },
    },
    authorName: { type: String, default: '' },
    storageQuota: { type: Number, default: 0 },
    showGpsInfo: { type: Boolean, default: false },
    showRssLink: { type: Boolean, default: false },
    exhibition: {
      coverPhotoId: { type: Schema.Types.ObjectId, ref: 'Photo', default: null },
      title: { type: String, default: '' },
      subtitle: { type: String, default: '' },
      description: { type: String, default: '' },
      startDate: { type: String, default: null },
      endDate: { type: String, default: null },
      theme: { type: String, enum: ['white', 'black'], default: 'white' },
      coverTextColor: { type: String, enum: ['white', 'black'], default: 'white' },
      coverProtection: { type: String, enum: ['auto', 'none', 'soft', 'medium', 'strong'], default: 'auto' },
      sections: {
        type: [{
          id: { type: String, required: true },
          layout: { type: String, enum: ['media', 'text', 'single-image', 'image-text', 'text-image', 'gallery'], default: 'media' },
          theme: { type: String, enum: ['white', 'black'], default: 'white' },
          title: { type: String, default: '' },
          body: { type: String, default: '' },
          photoIds: { type: [Schema.Types.ObjectId], ref: 'Photo', default: [] },
          textPosition: { type: String, enum: ['none', 'left', 'right', 'bottom'], default: 'none' },
          desktopTextAlign: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
          mobileTextAlign: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
          reserveTextSpace: { type: Boolean, default: false },
        }],
        default: [],
      },
    },
  },
  { timestamps: true },
)

export const SiteSettings = mongoose.models.SiteSettings || mongoose.model<ISiteSettings>('SiteSettings', SiteSettingsSchema)
