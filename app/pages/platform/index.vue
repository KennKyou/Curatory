<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { PlatformOverviewResponse } from '~~/server/types/api'

definePageMeta({ layout: 'platform' })

const { t, locale } = useI18n()
const { data: overview } = await useFetch<PlatformOverviewResponse>('/api/platform/overview')

function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return t('platform.timeAgo.justNow')
  if (minutes < 60) return t('platform.timeAgo.minutes', { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('platform.timeAgo.hours', { n: hours })
  const days = Math.floor(hours / 24)
  if (days < 30) return t('platform.timeAgo.days', { n: days })
  const months = Math.floor(days / 30)
  return t('platform.timeAgo.months', { n: months })
}

function formatDate(timestamp: string | null): string {
  if (!timestamp) return ''
  // EXIF takenAt has no timezone info — stored as UTC but represents local capture time
  // Display as UTC to avoid double-offset
  return new Date(timestamp).toLocaleString(locale.value, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'UTC',
  })
}
</script>

<template>
  <div class="py-8">
    <h1 class="text-2xl font-bold mb-6">{{ t('platform.overview') }}</h1>

    <!-- Stat cards -->
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
      <!-- Total Photos -->
      <Card class="gap-2 p-4">
        <CardHeader class="p-0">
          <CardTitle class="text-sm font-medium text-muted-foreground">{{ t('platform.totalPhotos') }}</CardTitle>
        </CardHeader>
        <CardContent class="p-0">
          <div class="text-2xl font-bold">{{ overview?.totalPhotos ?? 0 }}</div>
        </CardContent>
      </Card>

      <!-- Storage Used -->
      <Card class="gap-2 p-4">
        <CardHeader class="p-0">
          <CardTitle class="text-sm font-medium text-muted-foreground">{{ t('platform.storageUsed') }}</CardTitle>
        </CardHeader>
        <CardContent class="p-0">
          <div class="text-2xl font-bold">{{ formatBytes(overview?.storageUsed ?? 0) }}</div>
          <p class="text-xs text-muted-foreground mt-1">
            {{ t('platform.avgPerPhoto', { size: formatBytes(overview?.averagePhotoSize ?? 0) }) }}
          </p>
        </CardContent>
      </Card>

      <!-- Uploads This Month -->
      <Card class="gap-2 p-4">
        <CardHeader class="p-0">
          <CardTitle class="text-sm font-medium text-muted-foreground">{{ t('platform.uploadsThisMonth') }}</CardTitle>
        </CardHeader>
        <CardContent class="p-0">
          <div class="text-2xl font-bold">{{ overview?.uploadsThisMonth ?? 0 }}</div>
        </CardContent>
      </Card>

      <!-- Sync Completion -->
      <Card class="gap-2 p-4">
        <CardHeader class="p-0">
          <CardTitle class="text-sm font-medium text-muted-foreground">{{ t('platform.syncCompletion') }}</CardTitle>
        </CardHeader>
        <CardContent class="p-0">
          <div class="text-2xl font-bold">{{ overview?.syncCompletion ?? 0 }}%</div>
          <p class="text-xs text-muted-foreground mt-1">
            {{ overview?.pending ?? 0 }} {{ t('platform.pending') }} · {{ overview?.conflicts ?? 0 }} {{ t('platform.conflicts') }}
          </p>
        </CardContent>
      </Card>
    </div>

    <!-- Recent Activity -->
    <Card class="gap-4 p-4">
      <CardHeader class="p-0">
        <CardTitle>{{ t('platform.recentActivity') }}</CardTitle>
      </CardHeader>
      <CardContent class="p-0">
        <div v-if="!overview?.recentActivity?.length" class="text-sm text-muted-foreground py-4 text-center">
          {{ t('platform.noRecentActivity') }}
        </div>
        <div v-else class="divide-y divide-border">
          <div
            v-for="(event, i) in overview.recentActivity"
            :key="i"
            class="flex items-center gap-4 py-3"
          >
            <!-- Thumbnail -->
            <div class="h-12 w-12 rounded-md overflow-hidden bg-muted shrink-0">
              <img
                v-if="event.thumbnailUrl"
                :src="event.thumbnailUrl"
                :alt="event.name"
                class="h-full w-full object-cover"
              />
              <div v-else class="h-full w-full flex items-center justify-center">
                <Icon icon="material-symbols:image-outline" class="h-5 w-5 text-muted-foreground" />
              </div>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate">{{ event.name }}</p>
              <p class="text-xs text-muted-foreground">
                {{ t('platform.uploaded', { time: formatTimeAgo(event.timestamp) }) }}
                <template v-if="event.takenAt"> · {{ t('platform.taken', { date: formatDate(event.takenAt) }) }}</template>
              </p>
              <div class="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                <span>{{ formatBytes(event.size) }}</span>
                <span>·</span>
                <span>s3</span>
                <span>·</span>
                <span class="text-green-500">{{ t('platform.synced') }}</span>
              </div>
            </div>

            <!-- ID -->
            <div class="text-xs text-muted-foreground shrink-0 text-right">
              <span class="opacity-50">ID:</span>{{ event.slug }}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
