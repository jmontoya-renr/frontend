<script setup lang="ts">
import MessagesBox from './MessagesBox.vue'
import MoreMenu from './MoreMenu.vue'

defineProps<{
  solution_id: number
}>()
</script>

<template>
  <div class="flex items-center gap-2">
    <MessagesBox :solution_id="solution_id" />
    <MoreMenu :solution_id="solution_id" />
  </div>
</template>
