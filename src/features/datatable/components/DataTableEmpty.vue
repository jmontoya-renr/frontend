<script setup lang="ts">
interface Props {
  colSpan: number
}
const props = defineProps<Props>()
</script>

<template>
  <tbody>
    <tr role="row" class="border-b">
      <td :colspan="props.colSpan" class="p-2 h-24 text-center align-middle" role="gridcell">
        <!-- Default message, customizable via slot -->
        <slot>No results.</slot>
      </td>
    </tr>
  </tbody>
</template>
