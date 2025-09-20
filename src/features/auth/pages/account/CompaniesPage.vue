<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuthStore } from '@/features/auth/stores'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/shared/components/ui/select'

const auth = useAuthStore()

const CAT_ALL = '__ALL__'
const CAT_NONE = '__NONE__'

const q = ref('')
const activityFilter = ref<string>(CAT_ALL)

const companies = computed(() => auth.sociedades ?? [])

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

const normalized = computed(() =>
  companies.value.map((c) => ({
    ...c,
    _nNombre: norm(c.nombre),
    _nCodigo: norm(c.codigo),
  })),
)

const activities = computed<Array<string>>(() => {
  const a = Array.from(new Set(companies.value.map((c) => c.actividad && c.actividad.codigo)))
  return a.filter((c) => c != null).sort()
})

const filtered = computed(() => {
  const text = norm(q.value.trim())
  return normalized.value
    .filter((c) =>
      activityFilter.value === CAT_ALL
        ? true
        : activityFilter.value === CAT_NONE
          ? c.actividad === null
          : c.actividad?.codigo === activityFilter.value,
    )
    .filter((c) => !text || c._nNombre.includes(text) || c._nCodigo.includes(text))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
})

function capitalize(word: string) {
  if (!word) return ''
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}
</script>

<template>
  <header>
    <h3 class="text-lg font-medium">{{ $t('account.companies.title') }}</h3>
    <p class="text-sm text-muted-foreground">{{ $t('account.companies.description') }}</p>
  </header>

  <section aria-labelledby="companies-title" class="mx-auto max-w-5xl">
    <header class="mb-6">
      <h2 id="companies-title" class="sr-only">{{ $t('account.companies.title') }}</h2>
      <div
        role="region"
        aria-controls="companies-list"
        aria-label="Controles de listado"
        class="mt-4 flex flex-wrap justify-end items-center gap-2"
      >
        <Label for="search-companies" class="sr-only">{{ $t('forms.search') }}</Label>
        <Input
          id="search-companies"
          v-model="q"
          type="search"
          inputmode="search"
          :placeholder="`${$t('forms.search-name-code')}…`"
          class="md:w-64 max-sm:order-2"
        />

        <Select v-model="activityFilter">
          <SelectTrigger aria-label="Filtrar por actividad" class="w-full sm:w-[200px]">
            <SelectValue placeholder="Activity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="CAT_ALL">{{ $t('activities.all') }}</SelectItem>
            <SelectItem v-for="a in activities" :key="a" :value="a">{{ capitalize(a) }}</SelectItem>
            <SelectItem :value="CAT_NONE">{{ $t('activities.none') }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p
        class="ml-auto text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {{ $t('forms.results', filtered.length) }}
      </p>
    </header>

    <ul id="companies-list" role="list" class="grid gap-4 grid-auto-fill-325">
      <li v-if="filtered.length === 0" class="col-span-full">
        <Card>
          <CardHeader>
            <CardTitle class="text-base">{{ $t('forms.no-results') }}</CardTitle>
            <CardDescription>{{ $t('forms.change-filters') }}</CardDescription>
          </CardHeader>
        </Card>
      </li>

      <li v-for="c in filtered" :key="c.id">
        <article
          class="h-full"
          :aria-labelledby="`company-${c.codigo}`"
          :aria-describedby="`company-desc-${c.codigo}`"
        >
          <Card class="h-full">
            <CardHeader>
              <div class="flex items-start justify-between gap-2">
                <div>
                  <CardTitle :id="`company-${c.codigo}`" class="text-base">
                    {{ c.nombre }}
                  </CardTitle>
                  <CardDescription :id="`company-desc-${c.codigo}`">
                    {{ $t('account.companies.card.code') }}: {{ c.codigo }}
                  </CardDescription>
                </div>
                <Badge
                  :class="
                    c.activa
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                  "
                  class="shrink-0"
                  :aria-label="c.activa ? $t('companies.active') : $t('companies.inactive')"
                >
                  {{ c.activa ? $t('companies.active') : $t('companies.inactive') }}
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              <dl class="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                <div>
                  <dt class="text-xs text-muted-foreground">
                    {{ $t('account.companies.card.type') }}
                  </dt>
                  <dd class="text-sm font-medium">{{ c.tipo }}</dd>
                </div>
                <div class="flex items-center gap-2">
                  <div class="min-w-0">
                    <dt class="text-xs text-muted-foreground">
                      {{ $t('account.companies.card.activity') }}
                    </dt>
                    <dd class="text-sm font-medium">{{ c.actividad?.codigo ?? '—' }}</dd>
                  </div>
                </div>
                <div>
                  <dt class="text-xs text-muted-foreground">
                    {{ $t('account.companies.card.erp-publicidad') }}
                  </dt>
                  <dd class="text-sm font-medium">{{ c.erp_publicidad ?? '—' }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-muted-foreground">
                    {{ $t('account.companies.card.erp-financiero') }}
                  </dt>
                  <dd class="text-sm font-medium">{{ c.erp_financiero ?? '—' }}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </article>
      </li>
    </ul>
  </section>
</template>
