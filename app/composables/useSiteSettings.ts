import { toast } from 'vue-sonner'
import { defaultExhibitionSettings, type PlatformSettingsResponse } from '~~/server/types/api'

export function useSiteSettings() {
  const form = useState('siteSettingsForm', () => ({
    siteName: '',
    homePageTitle: '',
    siteDescription: '',
    siteUrl: '',
    socialLinks: {
      website: '',
      github: '',
      facebook: '',
      instagram: '',
      threads: '',
      x: '',
      email: '',
    },
    authorName: '',
    storageQuota: 0,
    showGpsInfo: false,
    showRssLink: false,
    exhibition: defaultExhibitionSettings(),
  }))

  const { t } = useI18n()
  const saving = useState('siteSettingsSaving', () => false)
  const saved = useState('siteSettingsSaved', () => false)
  const loaded = useState('siteSettingsLoaded', () => false)

  async function load() {
    const { data } = await useFetch<PlatformSettingsResponse>('/api/platform/settings')
    if (data.value) {
      form.value.siteName = data.value.siteName
      form.value.homePageTitle = data.value.homePageTitle
      form.value.siteDescription = data.value.siteDescription
      form.value.siteUrl = data.value.siteUrl
      form.value.socialLinks = { ...data.value.socialLinks }
      form.value.authorName = data.value.authorName
      form.value.showGpsInfo = data.value.showGpsInfo ?? false
      form.value.showRssLink = data.value.showRssLink ?? false
      form.value.exhibition = data.value.exhibition ?? defaultExhibitionSettings()
    }
    loaded.value = true
  }

  async function save() {
    saving.value = true
    saved.value = false
    try {
      await $fetch('/api/platform/settings', {
        method: 'PUT',
        body: {
          siteName: form.value.siteName,
          homePageTitle: form.value.homePageTitle,
          siteDescription: form.value.siteDescription,
          siteUrl: form.value.siteUrl,
          socialLinks: form.value.socialLinks,
          authorName: form.value.authorName,
          exhibition: form.value.exhibition,
        },
      })
      saved.value = true
      toast.success(t('settings.saved'))
      setTimeout(() => { saved.value = false }, 2000)
    } catch {
      toast.error(t('settings.saveFailed'))
    } finally {
      saving.value = false
    }
  }

  return { form, saving, saved, loaded, load, save }
}
