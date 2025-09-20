<script setup lang="ts">
import { ref, computed } from 'vue'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/components/ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/shared/components/ui/command'
import { Check, ChevronsUpDown } from 'lucide-vue-next'

export type SelectOption = Readonly<{
  label: string
  value: string
  disabled?: boolean
}>

// Accept array when multiple=true (backward compatible)
type ModelValue = string | string[] | null

const props = withDefaults(
  defineProps<{
    modelValue: ModelValue
    options: ReadonlyArray<SelectOption>
    multiple?: boolean
    placeholder?: string
    searchPlaceholder?: string
    emptyText?: string
    disabled?: boolean
    loading?: boolean
    clearable?: boolean
    /** popover width; e.g. 'w-[320px]' */
    contentClass?: string
    /** extra classes for the trigger button */
    buttonClass?: string
  }>(),
  {
    multiple: false,
    placeholder: 'Selecciona…',
    searchPlaceholder: 'Buscar…',
    emptyText: 'Sin resultados',
    disabled: false,
    loading: false,
    clearable: true,
    contentClass: 'w-[320px]',
    buttonClass: 'w-full h-8 px-2 justify-between',
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: ModelValue): void
  (e: 'change', v: ModelValue): void
}>()

const open = ref(false)

/** Normalize current selection into an array (single → [value] | []) */
const selectedValues = computed<string[]>(() => {
  if (Array.isArray(props.modelValue)) return props.modelValue
  return props.modelValue ? [props.modelValue] : []
})

const selectedSet = computed<Set<string>>(() => new Set(selectedValues.value))

const selectedOptions = computed<ReadonlyArray<SelectOption>>(() =>
  props.options.filter((o) => selectedSet.value.has(o.value)),
)

function isSelected(val: string): boolean {
  return selectedSet.value.has(val)
}

/** Emit helpers */
function commit(value: ModelValue) {
  emit('update:modelValue', value)
  emit('change', value)
}

/** Single-select behavior */
function selectSingle(v: string | null) {
  commit(v)
  open.value = false
}

/** Multi-select toggle (do not close the popover) */
function toggleValue(v: string) {
  const exists = selectedSet.value.has(v)
  const next = exists ? selectedValues.value.filter((x) => x !== v) : [...selectedValues.value, v]
  commit(next)
}

/** Clear selection (array for multiple, null for single) */
function clearSelection() {
  commit(props.multiple ? [] : null)
  if (!props.multiple) open.value = false
}

const buttonLabel = computed(() => {
  if (selectedOptions.value.length === 0) return ''
  if (!props.multiple || selectedOptions.value.length === 1) {
    return selectedOptions.value[0]?.label ?? ''
  }
  const first = selectedOptions.value[0]?.label ?? ''
  const rest = selectedOptions.value.length - 1
  return `${first} +${rest}`
})
</script>

<template>
  <Popover :open="open" @update:open="(v) => (open = v)">
    <PopoverTrigger as-child data-keep-edit-open>
      <Button
        :variant="'outline'"
        :class="buttonClass"
        role="combobox"
        :aria-expanded="open ? 'true' : 'false'"
        :aria-multiselectable="multiple ? 'true' : undefined"
        :disabled="disabled"
      >
        <span class="truncate text-left flex-1">
          {{ buttonLabel || placeholder }}
        </span>
        <ChevronsUpDown class="ml-2 h-4 w-4 opacity-50" />
      </Button>
    </PopoverTrigger>

    <PopoverContent
      side="bottom"
      align="start"
      class="p-0"
      :class="contentClass"
      data-keep-edit-open
    >
      <Command data-keep-edit-open>
        <CommandInput :placeholder="searchPlaceholder" data-keep-edit-open @keydown.stop />
        <CommandEmpty>{{ loading ? 'Cargando…' : emptyText }}</CommandEmpty>
        <CommandList data-keep-edit-open>
          <CommandGroup>
            <CommandItem
              v-if="clearable"
              value="__clear__"
              data-keep-edit-open
              :disabled="disabled || loading"
              @select="clearSelection"
            >
              <Check class="mr-2 h-4 w-4 opacity-0" />
              <span class="truncate text-muted-foreground">— Borrar selección —</span>
            </CommandItem>

            <CommandItem
              v-for="o in options"
              :key="o.value"
              :value="`${o.label} ${o.value}`"
              :data-keep-edit-open="true"
              :disabled="disabled || loading || o.disabled"
              @select="() => (multiple ? toggleValue(o.value) : selectSingle(o.value))"
            >
              <Check
                class="mr-2 h-4 w-4"
                :class="isSelected(o.value) ? 'opacity-100' : 'opacity-0'"
              />
              <span class="truncate">{{ o.label }}</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
