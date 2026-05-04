<script setup lang="ts">
definePageMeta({ layout: 'platform' })

const { t } = useI18n()
const route = useRoute()

const tabs = [
  { label: () => t('platform.library'), to: '/platform/photos' },
  { label: () => t('platform.sync'), to: '/platform/photos/sync' },
]

function isActive(to: string): boolean {
  return route.path === to || (to !== '/platform/photos' && route.path.startsWith(to))
}
</script>

<template>
  <div class="py-8">
    <h1 class="text-2xl font-bold mb-6">{{ t('platform.photos') }}</h1>

    <!-- Sub tabs -->
    <div class="flex gap-1 border-b border-border mb-6">
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="px-4 py-2 text-sm font-medium transition-colors no-underline -mb-px border-b-2"
        :class="isActive(tab.to) ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'"
      >
        {{ tab.label() }}
      </NuxtLink>
    </div>

    <NuxtPage />
  </div>
</template>
