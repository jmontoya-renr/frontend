<script setup lang="ts">
import { ref, watch } from 'vue'
import { formatUiDate } from '@/shared/utils/formatUiDate'

import { Skeleton } from '@/shared/components/ui/skeleton'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { CalendarIcon, Mail, MailOpen } from 'lucide-vue-next'
import { ScrollArea } from '@/shared/components/ui/scroll-area'

import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { useMessagesLazy } from '@/shared/composables/useMessagesLazy'

const props = defineProps<{
  solution_id: number
}>()

const isNotificationsOpen = ref(false)
const { messages, status, load } = useMessagesLazy(props.solution_id)

watch(isNotificationsOpen, (open) => {
  if (open) load()
})
</script>

<template>
  <Popover v-model:open="isNotificationsOpen" :key="solution_id">
    <PopoverTrigger as-child>
      <Button variant="ghost" size="icon" class="h-7 w-7 data-[state=open]:bg-accent">
        <Mail v-if="!isNotificationsOpen" />
        <MailOpen v-else />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-80 overflow-hidden rounded-lg p-0" align="end">
      <h4 class="px-4 py-3 font-semibold text-sm leading-none">
        {{ $t('solutions.messages.title') }}
      </h4>

      <Separator />
      <ScrollArea v-if="status === 'success' && messages.length" class="w-80 h-72 rounded-md">
        <template v-for="msg in messages" :key="msg.id">
          <article class="px-4 my-2 py-2 space-y-1">
            <p class="text-sm">{{ msg.texto_mensaje }}</p>
            <div class="flex items-center pt-2">
              <CalendarIcon class="mr-2 h-4 w-4 opacity-70" />
              <span class="text-xs text-muted-foreground">
                {{ formatUiDate(msg.fecha_alta_mensaje) }} -
                {{ formatUiDate(msg.fecha_baja_mensaje) }}
              </span>
            </div>
          </article>
          <Separator />
        </template>
      </ScrollArea>
      <article v-else-if="status === 'loading'" class="px-4 my-2 py-2 space-y-1">
        <Skeleton class="h-3 w-full" />
        <Skeleton class="h-3 w-40" />

        <div class="flex items-center pt-2">
          <Skeleton class="mr-2 h-4 w-4 rounded-full" />
          <Skeleton class="h-3 w-40" />
        </div>
      </article>

      <article v-else class="px-4 my-2 py-2 space-y-1 text-muted-foreground">
        <p class="text-sm">
          {{ $t('solutions.messages.empty') }}
        </p>
      </article>
    </PopoverContent>
  </Popover>
</template>
