<script setup lang="ts">
const route = useRoute()

definePageMeta({ layout: 'platform' })

await navigateTo(`/platform/exhibition/sections/${String(route.params.sectionId || '')}`, { replace: true })
</script>

<template>
  <div />
</template>
