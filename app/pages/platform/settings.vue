<script setup lang="ts">
definePageMeta({ layout: 'platform' })

const { t } = useI18n()
</script>

<template>
  <div class="py-8">
    <h1 class="text-2xl font-bold mb-6">{{ t('settings.title') }}</h1>

    <NuxtPage />
  </div>
</template>
