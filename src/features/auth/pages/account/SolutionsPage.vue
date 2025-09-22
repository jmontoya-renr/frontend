<script setup lang="ts">
import { computed, ref } from 'vue'
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
import { useAuthStore } from '@/features/auth/stores'
import { t } from '@/plugins/i18n'

type Rol = { id: number; nombre: string; codigo: 'ADMIN' | 'RW' | 'R' | string }

const auth = useAuthStore()
const companies = computed(() => auth.sociedades ?? [])
const solutions = computed(() => auth.soluciones ?? [])
const links = computed(() => auth.solucionesSociedades ?? [])

const CAT_ALL = '__ALL__'
const CAT_NONE = '__NONE__'

const q = ref('')
const companyFilter = ref<typeof CAT_ALL | typeof CAT_NONE | number>(CAT_ALL)
const roleFilter = ref<typeof CAT_ALL | typeof CAT_NONE | 'ADMIN' | 'RW' | 'R'>(CAT_ALL)

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
const byId = computed(() => new Map(companies.value.map((c) => [c.id, c])))

const rolesOptions = [
  { value: CAT_ALL, label: t('roles.all') },
  { value: 'ADMIN', label: t('roles.admin') },
  { value: 'RW', label: t('roles.rw') },
  { value: 'R', label: t('roles.r') },
  { value: CAT_NONE, label: t('roles.none') },
] as const

const joined = computed(() => {
  const map = byId.value
  return solutions.value
    .map((sol) => {
      const sol_links = links.value.filter((l) => l.id_solucion === sol.id && l.activo !== false)
      const sociedades = sol_links
        .map((l) => {
          const e = map.get(l.id_sociedad)
          if (!e) return null
          return {
            id: e.id,
            codigo: e.codigo,
            nombre: e.nombre,
            activa: e.activa,
            rol: l.rol,
          }
        })
        .filter(Boolean) as Array<{
        id: number
        codigo: string
        nombre: string
        activa: boolean
        rol: Rol
      }>

      return {
        ...sol,
        _nNombre: norm(sol.nombre),
        _nCodigo: norm(sol.codigo),
        sociedades: sociedades.sort((a, b) =>
          a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }),
        ),
        sociedadesCount: sociedades.length,
      }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
})

const companyOptions = computed(() => {
  const result = companies.value
    .slice()
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
    .map((e) => ({ value: e.id, label: `${e.nombre} (${e.codigo})` }))

  return [
    { value: CAT_ALL, label: t('companies.all') },
    ...result,
    { value: CAT_NONE, label: t('companies.none') },
  ]
})

const filtered = computed(() => {
  const text = norm(q.value.trim())
  return joined.value.filter((sol) => {
    const okText = !text || sol._nNombre.includes(text) || sol._nCodigo.includes(text)
    if (!okText) return false

    const okCompany =
      companyFilter.value === CAT_ALL
        ? true
        : companyFilter.value === CAT_NONE
          ? sol.sociedadesCount == 0
          : sol.sociedades.some((e) => e.id === companyFilter.value)
    if (!okCompany) return false

    const okRole =
      roleFilter.value === CAT_ALL
        ? true
        : roleFilter.value === CAT_NONE
          ? sol.sociedadesCount == 0
          : sol.sociedades.some((e) => e.rol?.codigo === roleFilter.value)
    return okRole
  })
})

function roleBadgeClass(code?: string) {
  switch (code) {
    case 'ADMIN':
      return 'bg-primary text-primary-foreground'
    case 'RW':
      return 'bg-secondary text-secondary-foreground'
    case 'R':
      return 'bg-muted text-foreground'
    default:
      return 'bg-accent text-accent-foreground'
  }
}
</script>

<template>
  <header>
    <h3 class="text-lg font-medium">{{ $t('account.solutions.title') }}</h3>
    <p class="text-sm text-muted-foreground">{{ $t('account.solutions.description') }}</p>
  </header>

  <section aria-labelledby="solutions-title" class="mx-auto max-w-5xl">
    <header class="mb-4">
      <h2 id="solutions-title" class="sr-only">{{ $t('account.solutions.title') }}</h2>
      <div
        role="region"
        aria-controls="solution-list"
        aria-label="Controles de listado"
        class="mb-4 flex flex-wrap justify-end items-center gap-2"
      >
        <Label for="search-solutions" class="sr-only">{{ $t('forms.search') }}</Label>
        <Input
          id="search-solutions"
          v-model="q"
          type="search"
          :placeholder="`${$t('forms.search-name-code')}…`"
          class="md:w-64 max-md:order-3"
        />

        <Select v-model="companyFilter">
          <SelectTrigger class="w-full sm:w-[300px]" aria-label="Filtrar por sociedad">
            <SelectValue placeholder="sociedad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="opt in companyOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select v-model="roleFilter">
          <SelectTrigger class="w-full sm:w-[170px]" aria-label="Filtrar por rol">
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="r in rolesOptions" :key="r.value" :value="r.value">
              {{ r.label }}
            </SelectItem>
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

    <ul role="list" class="grid gap-4 grid-auto-fill-300">
      <li v-if="filtered.length === 0" class="col-span-full">
        <Card>
          <CardHeader>
            <CardTitle class="text-base">{{ $t('forms.no-results') }}</CardTitle>
            <CardDescription>{{ $t('forms.change-filters') }}</CardDescription>
          </CardHeader>
        </Card>
      </li>

      <li v-for="s in filtered" :key="s.id">
        <article :aria-labelledby="`solution-${s.codigo}`" class="h-full">
          <Card class="h-full">
            <CardHeader>
              <div class="flex items-start justify-between gap-3">
                <div>
                  <CardTitle :id="`solution-${s.codigo}`" class="text-base">
                    {{ s.nombre }}
                  </CardTitle>
                  <CardDescription>
                    {{ $t('account.solutions.card.code') }}: {{ s.codigo }}
                  </CardDescription>
                </div>

                <div class="flex items-center gap-2">
                  <Badge
                    :class="
                      s.activa
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    "
                    :aria-label="s.activa ? $t('companies.active') : $t('companies.inactive')"
                  >
                    {{ s.activa ? $t('companies.active') : $t('companies.inactive') }}
                  </Badge>
                  <Badge
                    class="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                    :aria-label="`${$t('roles.title')}: ${s.rol?.nombre}`"
                  >
                    {{ s.rol?.codigo ?? '—' }}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <p class="mb-2 text-xs text-muted-foreground">
                {{ $t('companies.associated', s.sociedadesCount) }}
              </p>

              <ul class="divide-y">
                <li v-for="e in s.sociedades" :key="e.id" class="py-2 flex items-center gap-3">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium">
                      {{ e.nombre }}
                      <span class="text-muted-foreground">({{ e.codigo }})</span>
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{
                        e.activa
                          ? $t('account.solutions.card.active')
                          : $t('account.solutions.card.inactive')
                      }}
                    </p>
                  </div>
                  <Badge :class="roleBadgeClass(e.rol?.codigo)" class="ml-auto">
                    {{ e.rol?.codigo ?? '—' }}
                  </Badge>
                </li>
              </ul>
            </CardContent>
          </Card>
        </article>
      </li>
    </ul>
  </section>
</template>
