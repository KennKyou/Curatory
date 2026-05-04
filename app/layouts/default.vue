<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Toaster } from '@/components/ui/sonner'
import { useReactionsStore } from '@/stores/reactions'
import type { SiteSettingsResponse } from '~~/server/types/api'

const { t } = useI18n()
const reactionsStore = useReactionsStore()
const exhibitionActiveSlideIndex = useState('exhibitionActiveSlideIndex', () => 0)

const { data: siteSettings } = await useFetch<SiteSettingsResponse | null>('/api/site-settings', { default: () => null })
const exhibitionHeaderTitle = computed(() => {
  return siteSettings.value?.exhibition.title || siteSettings.value?.siteName || 'Curatory'
})
const seoTitle = computed(() => {
  const title = siteSettings.value?.exhibition.title?.trim() || ''
  const siteName = siteSettings.value?.siteName?.trim() || ''
  if (title && siteName) return `${title} | ${siteName}`
  if (title) return title
  return siteSettings.value?.homePageTitle || siteSettings.value?.siteName || 'Curatory'
})
const seoDescription = computed(() => {
  return siteSettings.value?.exhibition.description || siteSettings.value?.siteDescription || ''
})
const seoOgImage = computed(() => siteSettings.value?.exhibitionCoverPhoto?.url || '/api/og/site')
const seoCanonical = computed(() => siteSettings.value?.siteUrl || '')
useHead({
  title: () => seoTitle.value,
  meta: [
    { name: 'description', content: () => seoDescription.value },
    { property: 'og:image', content: () => seoOgImage.value },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
  ],
  link: [
    ...(seoCanonical.value ? [{ rel: 'canonical', href: seoCanonical.value }] : []),
  ],
})

const socialPlatforms = [
  { key: 'website', icon: 'material-symbols:language', label: 'Website' },
  { key: 'github', icon: 'mdi:github', label: 'GitHub' },
  { key: 'facebook', icon: 'mdi:facebook', label: 'Facebook' },
  { key: 'instagram', icon: 'mdi:instagram', label: 'Instagram' },
  { key: 'threads', icon: 'simple-icons:threads', label: 'Threads' },
  { key: 'x', icon: 'simple-icons:x', label: 'X' },
  { key: 'email', icon: 'material-symbols:mail-outline', label: 'Email' },
] as const

const socialLinksFiltered = computed<Array<{ key: string; icon: string; label: string; url: string }>>(() => {
  const links = siteSettings.value?.socialLinks
  if (!links) return []
  return socialPlatforms
    .filter(p => links[p.key as keyof typeof links])
    .map(p => ({ ...p, url: links[p.key as keyof typeof links] }))
})
const showHeaderLinks = computed(() => socialLinksFiltered.value.length > 0 && exhibitionActiveSlideIndex.value > 0)

// Hydration splash
const hydrated = ref(false)

onMounted(() => {
  reactionsStore.init()
  nextTick(() => { hydrated.value = true })
})
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Fixed capsule header -->
    <header
      class="fixed top-0 inset-x-0 z-50 flex pointer-events-none"
      :class="'justify-end px-4 py-4 sm:px-6'"
    >
      <div
        v-if="showHeaderLinks"
        class="pointer-events-auto flex items-center gap-1 rounded-full border border-zinc-400/35 bg-white/75 px-2 py-1 shadow-sm backdrop-blur-xl dark:border-white/15 dark:bg-black/45"
      >
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button
              data-test="exhibition-menu-trigger"
              type="button"
              class="flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium uppercase tracking-[0.16em] text-zinc-700 transition-colors hover:bg-zinc-950/5 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500/40 dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-white"
              :aria-label="t('header.social')"
            >
              <span>{{ t('header.links') }}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            :side-offset="10"
            data-test="exhibition-menu-content"
            class="w-auto min-w-40 rounded-2xl border-zinc-400/35 bg-white/75 p-2 text-zinc-700 shadow-sm backdrop-blur-xl dark:border-white/15 dark:bg-black/45 dark:text-zinc-200"
          >
            <DropdownMenuGroup>
              <DropdownMenuItem
                v-for="link in socialLinksFiltered"
                :key="link.key"
                as-child
              >
                <a
                  :href="link.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex cursor-pointer items-center gap-2 rounded-full px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-zinc-700 outline-none transition-colors focus:bg-zinc-950/5 focus:text-zinc-950 dark:text-zinc-200 dark:focus:bg-white/10 dark:focus:text-white"
                  :data-test="`exhibition-social-link-${link.key}`"
                >
                  <Icon :icon="link.icon" class="h-4 w-4" />
                  {{ link.label }}
                </a>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    <!-- Hydration splash -->
    <Transition
      leave-active-class="transition-opacity duration-300 ease-out"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="!hydrated"
        data-test="hydration-splash"
        class="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center gap-4"
      >
        <span data-test="hydration-splash-title" class="text-lg font-semibold text-foreground">{{ exhibitionHeaderTitle }}</span>
      </div>
    </Transition>

    <main v-show="hydrated" class="flex-1">
      <slot />
    </main>

    <Toaster position="bottom-center" theme="dark" rich-colors />
  </div>
</template>
