<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <Card class="gap-4 p-4">
    <CardHeader class="p-0">
      <CardTitle>{{ t('platform.scanBucket') }}</CardTitle>
      <CardDescription>{{ t('platform.scanDescription') }}</CardDescription>
    </CardHeader>
    <CardContent class="p-0">
      <ScanButton />
    </CardContent>
  </Card>
</template>
