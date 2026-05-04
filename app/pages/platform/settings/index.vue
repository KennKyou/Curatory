<script setup lang="ts">
import { Icon } from '@iconify/vue'

const { t } = useI18n()
const { form, saving, saved, loaded, load, save } = useSiteSettings()

if (!loaded.value) await load()

const socialPlatforms = [
  { key: 'website', icon: 'material-symbols:language', label: 'Website' },
  { key: 'github', icon: 'mdi:github', label: 'GitHub' },
  { key: 'facebook', icon: 'mdi:facebook', label: 'Facebook' },
  { key: 'instagram', icon: 'mdi:instagram', label: 'Instagram' },
  { key: 'threads', icon: 'simple-icons:threads', label: 'Threads' },
  { key: 'x', icon: 'simple-icons:x', label: 'X' },
  { key: 'email', icon: 'material-symbols:mail-outline', label: 'Email' },
] as const
</script>

<template>
  <div class="space-y-6">
    <Card class="gap-4 p-4">
      <CardHeader class="p-0">
        <div class="flex items-center justify-between">
          <div class="space-y-1">
            <CardTitle class="text-base">{{ t('settings.siteSettings') }}</CardTitle>
            <p class="text-sm text-muted-foreground">{{ t('settings.siteSettingsDescription') }}</p>
          </div>
          <Button data-test="settings-save" size="sm" :disabled="saving" @click="save">
            <Icon v-if="saved" icon="material-symbols:check" class="mr-1 h-4 w-4" />
            {{ saving ? t('settings.saving') : saved ? t('settings.saved') : t('settings.save') }}
          </Button>
        </div>
      </CardHeader>
      <CardContent class="space-y-4 p-0">
        <div class="space-y-2">
          <Label>{{ t('settings.siteName') }}</Label>
          <Input v-model="form.siteName" :placeholder="t('settings.siteNamePlaceholder')" maxlength="20" />
          <p class="text-xs text-muted-foreground">{{ t('settings.siteNameHint') }}</p>
        </div>
        <div class="space-y-2">
          <Label>{{ t('settings.homePageTitle') }}</Label>
          <Input v-model="form.homePageTitle" :placeholder="t('settings.homePageTitlePlaceholder')" />
          <p class="text-xs text-muted-foreground">{{ t('settings.homePageTitleHint') }}</p>
        </div>
        <div class="space-y-2">
          <Label>{{ t('settings.siteDescription') }}</Label>
          <Textarea v-model="form.siteDescription" :placeholder="t('settings.siteDescriptionPlaceholder')" rows="3" />
          <p class="text-xs text-muted-foreground">{{ t('settings.siteDescriptionHint') }}</p>
        </div>
        <div class="space-y-2">
          <Label>{{ t('settings.siteUrl') }}</Label>
          <Input v-model="form.siteUrl" placeholder="https://example.com" />
          <p class="text-xs text-muted-foreground">{{ t('settings.siteUrlHint') }}</p>
        </div>

        <!-- Social Links -->
        <div class="space-y-3 pt-2">
          <Label>{{ t('settings.socialLinks') }}</Label>
          <div
            v-for="platform in socialPlatforms"
            :key="platform.key"
            class="flex items-center gap-3"
          >
            <Icon :icon="platform.icon" class="h-5 w-5 text-muted-foreground shrink-0" />
            <Input
              v-model="form.socialLinks[platform.key]"
              :placeholder="platform.key === 'email' ? 'mailto:you@example.com' : `https://${platform.key === 'website' ? 'example.com' : platform.key + '.com/...'}`"
              class="flex-1"
            />
          </div>
        </div>
      </CardContent>
    </Card>

    <Card class="gap-3 p-4">
      <CardHeader class="p-0">
        <CardTitle class="text-base">{{ t('settings.legalNotice') }}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-2 p-0 text-sm text-muted-foreground">
        <p>
          Powered by Curatory — Source:
          <a
            href="https://github.com/KennKyou/Curatory"
            target="_blank"
            rel="noopener noreferrer"
            class="underline underline-offset-2 hover:text-foreground"
          >
            github.com/KennKyou/Curatory
          </a>
          — License: AGPL-3.0-or-later
        </p>
      </CardContent>
    </Card>
  </div>
</template>
