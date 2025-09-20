<script setup lang="ts">
import { cn } from '@/shared/utils/cn'
import { useAttrs, ref } from 'vue'

const props = defineProps<{ class?: string }>()
const attrs = useAttrs() as Record<string, string>

const divRef = ref<HTMLDivElement | null>(null)
</script>

<template>
  <div ref="divRef" :class="cn(props.class)" v-bind="attrs"><slot /></div>
</template>
