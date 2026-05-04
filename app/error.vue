<script setup lang="ts">
import { Icon } from '@iconify/vue'

const { t } = useI18n()
const error = useError()

const statusCode = computed(() => error.value?.statusCode ?? 0)

const errorConfig = computed(() => {
  switch (statusCode.value) {
    case 404:
      return {
        icon: 'material-symbols:explore-off-outline',
        title: t('error.notFound'),
        description: t('error.notFoundDesc'),
      }
    case 403:
      return {
        icon: 'material-symbols:lock-outline',
        title: t('error.forbidden'),
        description: t('error.forbiddenDesc'),
      }
    case 500:
      return {
        icon: 'material-symbols:cloud-off-outline',
        title: t('error.serverError'),
        description: t('error.serverErrorDesc'),
      }
    default:
      return {
        icon: 'material-symbols:error-outline',
        title: t('error.unknown'),
        description: t('error.unknownDesc', { code: statusCode.value }),
      }
  }
})

function handleBack() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <div class="min-h-screen bg-background flex items-center justify-center px-4">
    <div class="flex flex-col items-center text-center max-w-md">
      <Icon :icon="errorConfig.icon" class="h-16 w-16 text-muted-foreground/40" />

      <h1 class="mt-6 text-2xl font-semibold text-foreground">
        {{ errorConfig.title }}
      </h1>

      <p class="mt-2 text-sm text-muted-foreground leading-relaxed">
        {{ errorConfig.description }}
      </p>

      <button
        class="mt-8 inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/60 backdrop-blur-xl px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        @click="handleBack"
      >
        <Icon icon="material-symbols:arrow-back" class="h-4 w-4" />
        {{ t('error.backToHome') }}
      </button>

      <p v-if="statusCode" class="mt-6 text-xs tracking-widest text-muted-foreground/30 font-mono">
        {{ statusCode }}
      </p>
    </div>
  </div>
</template>
