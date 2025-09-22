<script setup lang="ts">
import { ref, computed, watch, type HTMLAttributes } from 'vue'
import {
  CalendarDate,
  DateFormatter,
  getLocalTimeZone,
  parseDate,
  today,
  type DateValue,
} from '@internationalized/date'
import { Button } from '@/shared/components/ui/button'
import { Calendar } from '@/shared/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { CalendarIcon } from 'lucide-vue-next'
import { toDate } from 'reka-ui/date'
import { cn } from '@/shared/utils/cn'

type Props = {
  modelValue: string | Date | null
  minValue?: DateValue | null
  maxValue?: DateValue | null
  disabled?: boolean
  /** Si true, el usuario no puede borrar la fecha desde el calendario */
  noClear?: boolean
  class?: HTMLAttributes['class']
  buttonClass?: HTMLAttributes['class']
  placeholderText?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  minValue: null,
  maxValue: null,
  disabled: false,
  noClear: false,
  class: undefined,
  buttonClass: undefined,
  placeholderText: 'Selecciona fecha',
})

const emit = defineEmits<{ (e: 'update:modelValue', v: string | null): void }>()

// --- Normalize external value to DateValue (accepts YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss or Date)
function toDateValue(input: string | Date | null | undefined): DateValue | undefined {
  if (!input) return undefined
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return undefined
    return new CalendarDate(input.getFullYear(), input.getMonth() + 1, input.getDate())
  }
  const s = String(input)
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (!m) return undefined
  try {
    return parseDate(m[1])
  } catch {
    return undefined
  }
}

const dv = computed<DateValue | undefined>({
  get: () => toDateValue(props.modelValue),
  // Nota: el “noClear” se aplica en el handler onPick (UI); aquí no bloqueamos cambios externos
  set: (val) => emit('update:modelValue', val ? val.toString() : null),
})

const placeholder = ref<DateValue>(toDateValue(props.modelValue) ?? today(getLocalTimeZone()))

watch(
  () => props.modelValue,
  (v) => {
    const nv = toDateValue(v)
    if (nv) placeholder.value = nv
  },
)

const df = new DateFormatter('es-ES', { dateStyle: 'long' })
const label = computed<string>(() =>
  dv.value ? df.format(toDate(dv.value)) : (props.placeholderText ?? 'Selecciona fecha'),
)

const open = ref(false)

// --- Prevent clear if noClear === true
function onPick(val: DateValue | undefined) {
  // If user tries to clear from UI and noClear is on, ignore it
  if (!val && props.noClear) return
  dv.value = val
  if (val) {
    placeholder.value = val
    open.value = false
  }
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <!-- mantener edición abierta dentro de la tabla -->
      <Button
        type="button"
        variant="outline"
        :disabled="props.disabled"
        :class="
          cn('w-[240px] ps-3 text-start font-normal', !dv && 'text-muted-foreground', buttonClass)
        "
        data-keep-edit-open
        aria-label="Abrir calendario"
        :aria-required="props.noClear ? 'true' : undefined"
      >
        <span class="truncate">{{ label }}</span>
        <CalendarIcon class="ms-auto h-4 w-4 opacity-50" />
      </Button>
    </PopoverTrigger>

    <PopoverContent class="w-auto p-0" align="start" data-keep-edit-open>
      <Calendar
        v-model:placeholder="placeholder"
        :model-value="dv"
        calendar-label="Selecciona fecha"
        initial-focus
        :min-value="props.minValue ?? undefined"
        :max-value="props.maxValue ?? undefined"
        @update:model-value="onPick"
        data-keep-edit-open
      />
    </PopoverContent>
  </Popover>
</template>
