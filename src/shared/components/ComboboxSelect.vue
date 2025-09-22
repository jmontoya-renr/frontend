<script setup lang="ts">
import { ref, computed } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
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
  /** Optional: precomputed lower label for cheap filtering */
  labelLower?: string
}>

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
    contentClass?: string
    buttonClass?: string
    /** Virtual list height in px */
    listHeight?: number
    /** Estimated row height in px */
    rowHeight?: number
  }>(),
  {
    multiple: false,
    placeholder: 'Selecciona…',
    searchPlaceholder: 'Buscar…',
    emptyText: 'Sin resultados',
    disabled: false,
    loading: false,
    clearable: true,
    contentClass: 'w-80 h-max ',
    buttonClass: 'w-full h-8 px-2 justify-between',
    listHeight: 280,
    rowHeight: 45,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: ModelValue): void
  (e: 'change', v: ModelValue): void
}>()

const open = ref(false)
const query = ref('') // local search text

/** Normalize selection to array */
const selectedValues = computed<string[]>(() => {
  if (Array.isArray(props.modelValue)) return props.modelValue
  return props.modelValue ? [props.modelValue] : []
})
const selectedSet = computed<Set<string>>(() => new Set(selectedValues.value))
const selectedOptions = computed(() => props.options.filter((o) => selectedSet.value.has(o.value)))
const isSelected = (v: string) => selectedSet.value.has(v)

/** Emit helpers */
function commit(value: ModelValue) {
  emit('update:modelValue', value)
  emit('change', value)
}
function selectSingle(v: string | null) {
  commit(v)
  open.value = false
}
function toggleValue(v: string) {
  const exists = selectedSet.value.has(v)
  const next = exists ? selectedValues.value.filter((x) => x !== v) : [...selectedValues.value, v]
  commit(next)
}
function clearSelection() {
  commit(null)
  if (!props.multiple) open.value = false
}

/** Fast filtering (uses precomputed labelLower if present) */
const filtered = computed<ReadonlyArray<SelectOption>>(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter((o) => (o.labelLower ?? o.label.toLowerCase()).includes(q))
})

/** Virtualization setup */
const scrollParent = ref<HTMLElement | null>(null)
const includeClear = computed(() => props.clearable)
const virtualCount = computed(() => filtered.value.length + (includeClear.value ? 1 : 0))

const rowVirtualizer = useVirtualizer(
  computed(() => ({
    count: virtualCount.value,
    getScrollElement: () => scrollParent.value,
    estimateSize: () => props.rowHeight, // keep it simple; tune if needed
    overscan: 8,
  })),
)

const virtualItems = computed(() => rowVirtualizer.value.getVirtualItems())
const totalSize = computed(() => rowVirtualizer.value.getTotalSize())

/** Map virtual index -> item (clear or option) */
function itemAt(index: number): { kind: 'clear' } | { kind: 'option'; opt: SelectOption } {
  if (includeClear.value) {
    if (index === 0) return { kind: 'clear' }
    return { kind: 'option', opt: filtered.value[index - 1]! }
  }
  return { kind: 'option', opt: filtered.value[index]! }
}

const buttonLabel = computed(() => {
  const count = selectedOptions.value.length
  if (count === 0) return ''
  if (props.multiple) {
    if (count === props.options.length && props.options.length > 0) return 'Todos'
    if (count === 1) return selectedOptions.value[0]?.label ?? ''
    const first = selectedOptions.value[0]?.label ?? ''
    return `${first} +${count - 1}`
  }
  return selectedOptions.value[0]?.label ?? ''
})
</script>

<template>
  <Popover data-keep-edit-open="true" :open="open" @update:open="(v) => (open = v)">
    <PopoverTrigger as-child data-keep-edit-open="true">
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
      class="p-0 overflow-hidden"
      :class="contentClass"
      data-keep-edit-open="true"
    >
      <Command data-keep-edit-open="true">
        <!-- Bind query to our local filter; fallback @input if your CommandInput lacks v-model -->
        <CommandInput
          v-model="query"
          :placeholder="searchPlaceholder"
          data-keep-edit-open
          @keydown.stop
          @input="(e: any) => (query = e?.target?.value ?? '')"
        />
        <CommandEmpty>{{ loading ? 'Cargando…' : emptyText }}</CommandEmpty>

        <!-- Scroll container for virtualization -->
        <CommandList data-keep-edit-open="true">
          <CommandGroup>
            <div
              ref="scrollParent"
              class="relative overflow-scroll h-max max-h-64"
              data-keep-edit-open="true"
            >
              <div :style="{ height: `${totalSize}px`, position: 'relative', width: '100%' }">
                <div
                  v-for="vi in virtualItems"
                  :key="String(vi.key)"
                  class="absolute left-0 top-0 w-full"
                  :style="{ transform: `translateY(${vi.start}px)`, height: `${vi.size}px` }"
                >
                  <!-- Render either 'clear' or actual option -->
                  <CommandItem
                    v-if="itemAt(vi.index).kind === 'clear'"
                    value="__clear__"
                    data-keep-edit-open="true"
                    :disabled="disabled || loading"
                    @select="clearSelection"
                  >
                    <Check class="mr-2 h-4 w-4 opacity-0" />
                    <span class="truncate text-muted-foreground">— Borrar selección —</span>
                  </CommandItem>

                  <CommandItem
                    v-else
                    :value="`${(itemAt(vi.index) as any).opt.label} ${(itemAt(vi.index) as any).opt.value}`"
                    data-keep-edit-open="true"
                    :disabled="disabled || loading || (itemAt(vi.index) as any).opt.disabled"
                    @select="
                      () =>
                        multiple
                          ? toggleValue((itemAt(vi.index) as any).opt.value)
                          : selectSingle((itemAt(vi.index) as any).opt.value)
                    "
                  >
                    <Check
                      class="mr-2 h-4 w-4"
                      :class="
                        isSelected((itemAt(vi.index) as any).opt.value)
                          ? 'opacity-100'
                          : 'opacity-0'
                      "
                    />
                    <span class="truncate">{{ (itemAt(vi.index) as any).opt.label }}</span>
                  </CommandItem>
                </div>
              </div>
            </div>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
