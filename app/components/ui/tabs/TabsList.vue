<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { TabsList, type TabsListProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<TabsListProps & { class?: HTMLAttributes['class'] }>()
</script>

<template>
  <TabsList
    v-bind="props"
    data-slot="tabs-list"
    :class="cn(
      'bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-0.5',
      props.class,
    )"
  >
    <slot />
  </TabsList>
</template>
