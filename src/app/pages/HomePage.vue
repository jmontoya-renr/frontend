<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter, type RouteRecordName, type RouteRecordNormalized } from 'vue-router'
import { ChevronRight } from 'lucide-vue-next'

import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from '@/shared/components/ui/select'
import { Card, CardTitle } from '@/shared/components/ui/card'
import { useAuthStore } from '@/features/auth/stores'

const router = useRouter()
const auth = useAuthStore()

const SEP = '::' as const
const isStrName = (n: RouteRecordName | null | undefined): n is string =>
  typeof n === 'string' && n.length > 0

type ParsedName = { solutionId?: string; pageCode: string }
const parseName = (n: RouteRecordName | null | undefined): ParsedName => {
  if (!isStrName(n)) return { pageCode: '' }
  const i = n.indexOf(SEP)
  return i === -1
    ? { pageCode: n }
    : { solutionId: n.slice(0, i), pageCode: n.slice(i + SEP.length) }
}

const solutionIndexRoutes = computed<RouteRecordNormalized[]>(() => {
  const allowed = new Set<string>(auth.soluciones.map((s) => s.codigo))

  const groups = new Map<string, RouteRecordNormalized[]>()

  for (const r of router.getRoutes()) {
    if (!isStrName(r.name)) continue
    const { solutionId } = parseName(r.name)

    const canSee = allowed.has(r.name) || (solutionId ? allowed.has(solutionId) : false)
    if (!canSee) continue

    const key = solutionId ?? String(r.name)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }

  const selected: RouteRecordNormalized[] = []

  for (const [key, items] of groups) {
    const parent = items.find(
      (rr) => isStrName(rr.name) && !parseName(rr.name).solutionId && String(rr.name) === key,
    )
    if (parent) {
      selected.push(parent)
      continue
    }

    const index = items.find((rr) => {
      const p = parseName(rr.name)
      return !!p.solutionId && p.solutionId === key && p.pageCode === 'index'
    })
    if (index) {
      selected.push(index)
      continue
    }

    const only = items.length === 1 ? items[0] : undefined
    if (only && !parseName(only.name).solutionId) {
      selected.push(only)
      continue
    }
  }

  return selected
})

const CAT_ALL = '__ALL__'
const CAT_NONE = '__NONE__'

const selectedCategory = ref<string>(CAT_ALL)
const query = ref('')

type SolutionItem = {
  name: string
  displayName: string
  firstLetter: string
  category: string | null
}

const normalized = computed<SolutionItem[]>(() =>
  solutionIndexRoutes.value.map((r) => {
    const title = typeof r.meta.title === 'function' ? r.meta.title() : r.meta.title
    const display = title ?? (typeof r.name === 'string' ? r.name : r.path)
    const first = display.trim().charAt(0).toUpperCase() || '#'
    const category =
      typeof r.meta?.category === 'string' && r.meta.category.trim() !== ''
        ? r.meta.category.trim()
        : null

    return {
      name: String(r.name),
      displayName: display,
      firstLetter: first,
      category,
    }
  }),
)

const categoryOptions = computed<Array<string>>(() => {
  const set = new Set<string>()
  for (const s of normalized.value) {
    if (s.category) set.add(s.category)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
})

const filtered = computed<SolutionItem[]>(() => {
  const q = query.value.trim().toLowerCase()
  const cat = selectedCategory.value

  return normalized.value.filter((s) => {
    const matchesCat =
      cat === CAT_ALL ? true : cat === CAT_NONE ? s.category === null : s.category === cat

    if (!matchesCat) return false
    if (!q) return true
    const hay = (s.displayName + ' ' + (s.category ?? '')).toLowerCase()
    return hay.includes(q)
  })
})

const groupedAndSorted = computed(() => {
  const groups = new Map<string, SolutionItem[]>()
  const uncategorized: SolutionItem[] = []

  for (const s of filtered.value) {
    if (!s.category) {
      uncategorized.push(s)
    } else {
      if (!groups.has(s.category)) groups.set(s.category, [])
      groups.get(s.category)!.push(s)
    }
  }

  for (const [, items] of groups) {
    items.sort((a, b) => a.displayName.localeCompare(b.displayName))
  }
  uncategorized.sort((a, b) => a.displayName.localeCompare(b.displayName))

  const categorized = Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => ({ category, items }))

  return { categorized, uncategorized }
})
</script>

<template>
  <main class="mx-auto flex flex-col px-16 py-8 w-full max-w-7xl">
    <!-- Header -->
    <header class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight">{{ $t('app.home.title') }}</h1>
      <p class="mt-2 text-sm text-muted-foreground">{{ $t('app.home.description') }}</p>
    </header>

    <section aria-label="Filters" class="mb-6 flex flex-wrap-reverse gap-3 justify-end">
      <div class="flex-1">
        <Input
          id="search"
          v-model="query"
          :placeholder="$t('app.home.search')"
          class="mt-1 min-w-64"
          type="search"
          autocomplete="off"
        />
      </div>

      <div class="w-full sm:w-64">
        <Select v-model="selectedCategory">
          <SelectTrigger id="category" class="mt-1 w-full">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup class="max-h-56">
              <SelectItem :value="CAT_ALL">{{ $t('categories.all') }}</SelectItem>
              <SelectItem v-for="cat in categoryOptions" :key="cat" :value="cat">
                {{ cat }}
              </SelectItem>
              <SelectItem :value="CAT_NONE">{{ $t('categories.none') }}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </section>

    <section aria-label="Solutions" class="w-full flex flex-col gap-8">
      <div class="max-sm:space-y-6 sm:flex sm:flex-wrap gap-4">
        <fieldset
          v-for="group in groupedAndSorted.categorized"
          :key="group.category"
          class="rounded-lg border p-4"
        >
          <legend class="px-2 text-sm font-medium text-muted-foreground">
            {{ group.category }}
          </legend>

          <ul role="list" class="flex max-sm:flex-col flex-wrap gap-4">
            <li v-for="item in group.items" :key="item.name">
              <RouterLink
                class="group outline-none"
                :to="{ name: item.name }"
                :aria-label="`Open ${item.displayName}`"
              >
                <Card
                  class="overflow-hidden min-w-56 relative py-4 transition duration-200 hover:shadow-md group-focus:ring-2 group-focus:ring-ring"
                >
                  <div class="absolute top-0.75 left-1 size-13 -rotate-6">
                    <div
                      class="flex h-full w-full items-center justify-center rounded-lg border bg-muted/60 text-2xl font-extrabold backdrop-blur"
                      aria-hidden="true"
                    >
                      {{ item.firstLetter }}
                    </div>
                  </div>

                  <CardTitle class="ml-16 mr-8 text-base font-semibold">
                    {{ item.displayName }}
                  </CardTitle>

                  <ChevronRight
                    class="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100 group-focus:translate-x-1 group-focus:opacity-100"
                    aria-hidden="true"
                  />
                </Card>
              </RouterLink>
            </li>
          </ul>
        </fieldset>
      </div>
      <div v-if="groupedAndSorted.uncategorized.length">
        <ul role="list" class="mt-2 flex max-sm:flex-col sm:w-fit flex-wrap gap-4">
          <li v-for="item in groupedAndSorted.uncategorized" :key="item.name">
            <RouterLink
              class="group outline-none"
              :to="{ name: item.name }"
              :aria-label="`Open ${item.displayName}`"
            >
              <Card
                class="overflow-hidden min-w-56 relative py-4 transition duration-200 hover:shadow-md group-focus:ring-2 group-focus:ring-ring"
              >
                <div class="absolute top-0.75 left-1 size-13 -rotate-6">
                  <div
                    class="flex h-full w-full items-center justify-center rounded-lg border bg-muted/60 text-2xl font-extrabold backdrop-blur"
                    aria-hidden="true"
                  >
                    {{ item.firstLetter }}
                  </div>
                </div>

                <CardTitle class="ml-16 mr-8 text-base font-semibold">
                  {{ item.displayName }}
                </CardTitle>

                <ChevronRight
                  class="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100 group-focus:translate-x-1 group-focus:opacity-100"
                  aria-hidden="true"
                />
              </Card>
            </RouterLink>
          </li>
        </ul>
      </div>

      <p
        v-if="!groupedAndSorted.categorized.length && !groupedAndSorted.uncategorized.length"
        class="text-sm text-muted-foreground"
      >
        {{ $t('forms.no-results') }}
      </p>
    </section>
  </main>
</template>
